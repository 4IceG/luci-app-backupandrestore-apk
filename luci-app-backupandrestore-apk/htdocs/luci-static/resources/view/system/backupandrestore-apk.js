'use strict';
'require view';
'require rpc';
'require ui';
'require poll';
'require fs';

/*
	Copyright 2026 Rafał Wabik - IceG - From eko.one.pl forum
	
	Licensed to the GNU General Public License v3.0.
*/

let css = '								\
	.controls {							\
		display: flex;					\
		margin: .5em 0 1em 0;			\
		flex-wrap: wrap;				\
		justify-content: space-around;	\
	}									\
										\
	.controls > * {						\
		padding: .25em;					\
		white-space: nowrap;			\
		flex: 1 1 33%;					\
		box-sizing: border-box;			\
		display: flex;					\
		flex-wrap: wrap;				\
		align-items: flex-start;		\
	}									\
										\
	.controls > *:first-child,			\
	.controls > * > label {				\
		flex-basis: 100%;				\
		min-width: 250px;				\
		margin-bottom: 0;				\
	}									\
										\
	.controls > *:nth-child(2),			\
	.controls > *:nth-child(3) {		\
		flex-basis: 20%;				\
	}									\
										\
	.controls > * > .btn {				\
		flex-basis: 20px;				\
		text-align: center;				\
	}									\
										\
	.controls > * > .cbi-progressbar {	\
		margin-top: 0;					\
	}									\
										\
	.controls > * > *:not(label) {		\
		flex-grow: 1;					\
		align-self: center;				\
	}									\
										\
	.controls > div > input {			\
		width: auto;					\
	}									\
										\
	.td.status {						\
		width: 26em;					\
		text-align: center;				\
	}									\
										\
	.table {							\
		border: 1px solid #ddd;			\
	}									\
										\
	.status-icon.pending {				\
		color: #999;					\
	}									\
										\
	.status-icon.installed {			\
		color: #4CAF50;					\
		font-weight: bold;				\
	}									\
										\
	.operation-status {					\
		display: none;					\
		padding: 12px 16px;				\
		border: 1px solid #ddd;			\
		border-radius: 5px;				\
		margin: 15px 0;					\
	}									\
										\
	#package-table tr:nth-child(odd) td{	\
		background: var(--background-color-medium) !important;	\
		border-bottom: 1px solid var(--border-color-medium) !important;	\
		border-top: 1px solid var(--border-color-medium) !important;	\
	}									\
	#package-table tr:nth-child(even) td{	\
		border-bottom: 1px solid var(--border-color-medium) !important;	\
		border-top: 1px solid var(--border-color-medium) !important;	\
	}									\
';

function popTimeout(a, message, timeout, severity) {
	ui.addTimeLimitedNotification(a, message, timeout, severity);
}

let callPackageBackup = rpc.declare({
	object: 'backupandrestore-apk',
	method: 'backup',
	expect: {}
});

let callPackageList = rpc.declare({
	object: 'backupandrestore-apk',
	method: 'list',
	expect: {}
});

let callPackageRestore = rpc.declare({
	object: 'backupandrestore-apk',
	method: 'restore',
	expect: {}
});

let callPackageProgress = rpc.declare({
	object: 'backupandrestore-apk',
	method: 'progress',
	expect: {}
});

let callPackageCount = rpc.declare({
	object: 'backupandrestore-apk',
	method: 'count',
	expect: {}
});

let packageStates = {};
let isInstalling = false;
let wasInstalling = false;

return view.extend({
	load: function() {
		return Promise.all([
			callPackageList(),
			callPackageCount(),
			callPackageProgress(),
			L.resolveDefault(
				fs.exec_direct('/usr/bin/opkg', ['list-installed'], 'text')
					.catch(function() {
						return fs.exec_direct('/usr/libexec/opkg-call', ['list-installed'], 'text')
							.catch(function() {
								return fs.exec_direct('/usr/libexec/package-manager-call', ['list-installed'], 'text')
									.catch(function() { return ''; });
							});
					})
					.then(function(data) {
						data = (data || '').trim();
						return data ? data.split('\n') : [];
					}),
				[]
			)
		]);
	},

	updateProgress: function(data) {
		let mainProgressBar = document.getElementById('main-progressbar');
		let progressLabel = document.getElementById('progress-label');
		let installAlert = document.getElementById('install-alert');
		
		if (!mainProgressBar) {
			return false;
		}

		console.log('updateProgress:', data);

		if (!data.active && !data.completed) {
			mainProgressBar.firstElementChild.style.width = '0%';
			mainProgressBar.firstElementChild.textContent = '\u00a0';
			mainProgressBar.setAttribute('title', '');
			
			if (progressLabel) {
				progressLabel.textContent = _('Installation progress:' );
			}
			
			if (installAlert) {
				installAlert.style.display = 'none';
			}
			
			isInstalling = false;
			wasInstalling = false;
			this.updateButtons();
			return false;
		}

		if (data.completed) {
			console.log('Installation completed, stopping polling');
			
			if (progressLabel) {
				progressLabel.textContent = _('Installation completed') + ' (' + data.total + ' / ' + data.total + ')';
			}
			
			mainProgressBar.firstElementChild.style.width = '100%';
			mainProgressBar.firstElementChild.textContent = '\u00a0';
			mainProgressBar.setAttribute('title', '');
			
			if (installAlert) {
				installAlert.style.display = 'none';
			}
			
			for (let pkg in packageStates) {
				if (packageStates[pkg] !== 'installed') {
					packageStates[pkg] = 'installed';
					this.updatePackageRow(pkg, 'installed');
				}
			}
			
			isInstalling = false;
			this.updateButtons();
			
			console.log('Returning false to stop polling, wasInstalling:', wasInstalling);

			if (wasInstalling) {
				wasInstalling = false;
				setTimeout(function() { 
					window.location.reload(); 
				}, 1500);
			}
			
			return false;
		}

		wasInstalling = true;
		isInstalling = true;
		this.updateButtons();
		
		if (installAlert && data.active) {
			installAlert.style.display = 'block';
		}

		if (progressLabel) {
			if (data.package) {
				progressLabel.textContent = _('Installing: ') + data.package + ' (' + data.current + ' / ' + data.total + ')';
			} else {
				progressLabel.textContent = _('Installing packages') + ' (' + data.current + ' / ' + data.total + ')';
			}
		}
		
		let percent = Math.floor((data.current / data.total) * 100);
		mainProgressBar.firstElementChild.style.width = percent + '%';
		mainProgressBar.firstElementChild.textContent = '\u00a0';
		mainProgressBar.setAttribute('title', '');
		
		if (data.package) {
			for (let pkg in packageStates) {
				if (packageStates[pkg] === 'installing' && pkg !== data.package) {
					packageStates[pkg] = 'installed';
					this.updatePackageRow(pkg, 'installed');
				}
			}
			
			if (packageStates[data.package] !== undefined) {
				packageStates[data.package] = 'installing';
				this.updatePackageRow(data.package, 'installing');
			}
		}
		
		return true;
	},

	updatePackageRow: function(packageName, status) {
		let safeId = 'pkg-' + packageName.replace(/[^a-zA-Z0-9]/g, '_');
		let row = document.getElementById(safeId);
		
		if (!row) return;
		
		row.classList.remove('installing', 'installed');
		if (status !== 'pending') {
			row.classList.add(status);
		}
		
		let statusCell = row.querySelector('.td.status');
		if (statusCell) {
			statusCell.innerHTML = '';
			
			switch(status) {
				case 'pending':
					statusCell.appendChild(E('span', { 'class': 'status-icon pending' }, '⌛ ' + _('Waiting for installation...')));
					break;
				case 'installing':
					statusCell.appendChild(E('span', { 'class': 'spinning' }, _('Installing...')));
					break;
				case 'installed':
					statusCell.appendChild(E('span', { 'class': 'status-icon installed' }, '✔ ' + _('Installed')));
					break;
			}
		}
	},

	updateButtons: function() {
		let installBtn = document.getElementById('install-btn');
		let createBtn = document.getElementById('create-btn');
		let loadBtn = document.getElementById('load-btn');
		let editBtn = document.getElementById('edit-btn');
		let saveBtn = document.getElementById('save-btn');
		let clearBtn = document.getElementById('clear-btn');
		
		if (installBtn) {
			installBtn.disabled = isInstalling;
		}
		if (createBtn) {
			createBtn.disabled = isInstalling;
		}
		if (loadBtn) {
			loadBtn.disabled = isInstalling;
		}
		if (editBtn) {
			editBtn.disabled = isInstalling;
		}
		if (saveBtn) {
			saveBtn.disabled = isInstalling;
		}
		if (clearBtn) {
			clearBtn.disabled = isInstalling;
		}
	},

	handleBackup: function() {
		ui.showModal(_('Creating package list'), [
			E('p', { 'class': 'spinning' }, _('Saving package list...'))
		]);

		return callPackageBackup().then(function(result) {
			ui.hideModal();
			if (result.success) {
				popTimeout(null, E('p', {}, 
					_('List created. Saved %d packages.').format(result.count)), 5000, 'info');
				setTimeout(function() { window.location.reload(); }, 1000);
			} else {
				ui.addNotification(null, E('p', {}, _('Error creating list.')), 'error');
			}
		}).catch(function(err) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, _('Error: %s').format(err.message)), 'error');
		});
	},

	handleRestore: function() {
		let self = this;
		
		return callPackageCount().then(function(countData) {
			if (!countData.exists || !countData.count || countData.count === 0) {
				ui.addNotification(null, E('p', {}, 
					_('No packages. Create list first.')), 'warning');
				return;
			}

			ui.showModal(_('Confirmation'), [
				E('p', {}, _('Install %d packages from list?').format(countData.count)),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
					' ',
					E('button', {
						'class': 'btn cbi-button-action',
						'click': function() {
							ui.hideModal();
							self.startInstallation();
						}
					}, _('Install'))
				])
			]);
		});
	},

	startInstallation: function() {
		let self = this;
		
		callPackageRestore().then(function(result) {
			if (result.success) {
				isInstalling = true;
				self.updateButtons();
				
				let installAlert = document.getElementById('install-alert');
				if (installAlert) {
					installAlert.style.display = 'block';
				}

				let pollFn = function() {
					return callPackageProgress().then(function(prog) {
						console.log('Poll tick, progress:', prog);
						let stillActive = self.updateProgress(prog);
						console.log('stillActive:', stillActive);
						if (!stillActive) {
							console.log('Removing poll function');
							poll.remove(pollFn);
						}
					}).catch(function(err) {
						console.error('Progress poll error:', err);
						poll.remove(pollFn);
						isInstalling = false;
						self.updateButtons();
						ui.addNotification(null, E('p', {}, _('Error monitoring progress')), 'error');
					});
				};
				
				poll.add(pollFn, 1);
			} else {
				ui.addNotification(null, E('p', {}, result.error || _('Installation error')), 'error');
			}
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, 'Błąd: ' + err.message), 'error');
		});
	},

	handleLoadFile: function() {
		let fileInput = E('input', {
			'type': 'file',
			'accept': '.txt',
			'change': function(ev) {
				let file = ev.target.files[0];
				if (!file) return;

				let reader = new FileReader();
				reader.onload = function(e) {
					fs.write('/etc/backup/list-user-installed-packages.txt', e.target.result)
						.then(function() {
							popTimeout(null, E('p', {}, _('File list-user-installed-packages.txt has been loaded')), 5000, 'info');
							setTimeout(function() { window.location.reload(); }, 1000);
						})
						.catch(function(err) {
							ui.addNotification(null, E('p', {}, _('Write error: ') + err.message), 'error');
						});
				};
				reader.readAsText(file);
			}
		});
		fileInput.click();
	},

	handleSaveFile: function() {
		fs.read('/etc/backup/list-user-installed-packages.txt')
			.then(function(content) {
				let blob = new Blob([content], { type: 'text/plain' });
				let url = URL.createObjectURL(blob);
				let a = E('a', { 'href': url, 'download': 'list-user-installed-packages.txt' });
				a.click();
				URL.revokeObjectURL(url);
				popTimeout(null, E('p', {}, _('File list-user-installed-packages.txt downloaded')), 5000, 'info');
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Read error: ') + err.message), 'error');
			});
	},

	handleEditFile: function() {
		let self = this;
		
		fs.read('/etc/backup/list-user-installed-packages.txt')
			.then(function(content) {
				ui.showModal(_('Editing package lists'), [
					E('p', {}, _('The window allows the user to edit the list of installed packages.')),
					E('textarea', {
						'id': 'edit_modal_content',
						'class': 'cbi-input-textarea',
						'style': 'width:100% !important; height:60vh; min-height:500px;',
						'wrap': 'off',
						'spellcheck': 'false'
					}, content.trim()),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Close')), ' ',
						E('button', {
							'class': 'btn cbi-button-remove',
							'click': function() {
								fs.read('/etc/backup/list-user-installed-packages.txt')
									.then(function(originalContent) {
										document.getElementById('edit_modal_content').value = originalContent.trim();
									})
									.catch(function(e) {
										ui.addNotification(null, E('p', _('Unable to reload the file') + ': %s'.format(e.message)), 'error');
									});
							}
						}, _('Undo')), ' ',
						E('button', {
							'class': 'cbi-button cbi-button-apply important',
							'click': function() {
								let newContent = document.getElementById('edit_modal_content').value;
								fs.write('/etc/backup/list-user-installed-packages.txt', newContent)
									.then(function() {
										ui.hideModal();
										popTimeout(null, E('p', {}, _('Package list has been saved')), 5000, 'info');
										setTimeout(function() { window.location.reload(); }, 1000);
									})
									.catch(function(e) {
										ui.addNotification(null, E('p', _('Unable to save the file') + ': %s'.format(e.message)), 'error');
									});
							}
						}, _('Save'))
					])
				], 'cbi-modal');
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Read error: ') + err.message), 'error');
			});
	},

	handleClearList: function() {
		let self = this;
		
		ui.showModal(_('Confirm clear list'), [
			E('p', {}, _('Are you sure you want to clear the package list?')),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button-neutral', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': function() {
						ui.hideModal();
						
						fs.remove('/etc/backup/list-user-installed-packages.txt')
							.then(function() {
								popTimeout(null, E('p', {}, _('List cleared')), 5000, 'info');
								setTimeout(function() { window.location.reload(); }, 1000);
							})
							.catch(function(err) {
								ui.addNotification(null, E('p', {}, _('Error clearing list: %s').format(err.message)), 'error');
							});
					}
				}, _('Clear'))
			])
		]);
	},

	renderPackageTable: function(packages, installedPackages) {
		let self = this;
		
		if (!packages.success || !packages.exists || !packages.packages || packages.packages.length === 0) {
			return null;
		}

		let packageTableTitles = [
			_('Status'),
			_('Package name'),
			'',
			''
		];

		let table = E('table', {
			'class': 'table',
			'id': 'package-table',
			'style': 'border:1px solid let(--border-color-medium)!important; table-layout:fixed; border-collapse:collapse; width:100%; font-size:12px;'
		},
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th', 'style': 'text-align:center; width:29%;' }, packageTableTitles[0]),
				E('th', { 'class': 'th left', 'style': 'width:61%;' }, packageTableTitles[1]),
				E('th', { 'class': 'th', 'style': 'text-align:center; width:5%;' }, packageTableTitles[2]),
				E('th', { 'class': 'th', 'style': 'text-align:center; width:5%;' }, packageTableTitles[3])
			])
		);

		packageStates = {};
		installedPackages = installedPackages || [];

		installedPackages = installedPackages.filter(function(line) {
			return line && line.trim() !== '';
		});
		
		packages.packages.forEach(function(pkg) {
			let isInstalled = installedPackages.some(function(line) {
				return line.includes(pkg);
			});
			packageStates[pkg] = isInstalled ? 'installed' : 'pending';
		});

		packages.packages.forEach(function(pkg) {
			var safeId = 'pkg-' + pkg.replace(/[^a-zA-Z0-9]/g, '_');
			var status = packageStates[pkg];
			
			table.appendChild(E('tr', { 'class': 'tr' + (status === 'installed' ? ' installed' : ''), 'id': safeId }, [
				E('td', { 'class': 'td status' }, [
					status === 'installed' ?
						E('span', { 'class': 'status-icon installed' }, '✓ ' + _('Installed'))
						:
						E('span', { 'class': 'status-icon pending' }, '⌛ ' + _('Waiting for installation...'))
				]),
				E('td', { 'class': 'td left' }, pkg),
				E('td', { 'class': 'td', 'style': 'text-align:center;' }, [
					E('button', {
						'class': 'btn cbi-button-neutral',
						'data-tooltip': _('Remove from list'),
						'click': function() {
							self.handleRemoveFromList(pkg);
						}
					}, _('🗑️'))
				]),
				E('td', { 'class': 'td', 'style': 'text-align:center;' }, [
					status === 'installed' ?
						E('button', {
							'class': 'cbi-button cbi-button-negative',
							'data-tooltip': _('Remove...'),
							'click': function() {
								self.handleUninstallPackage(pkg);
							}
						}, _('✘'))
						:
						''
				])
			]));
		});

		return table;
	},

	handleRemoveFromList: function(packageName) {
		let self = this;
		
		if (!confirm(_('Remove "%s" from the package list?').format(packageName))) {
			return;
		}
		
		fs.read('/etc/backup/list-user-installed-packages.txt')
			.then(function(content) {
				let lines = content.split('\n').filter(function(line) {
					return line.trim() !== '' && line.trim() !== packageName;
				});

				let newContent = lines.length > 0 ? lines.join('\n') + '\n' : '';
				return fs.write('/etc/backup/list-user-installed-packages.txt', newContent);
			})
			.then(function() {
				popTimeout(null, E('p', {}, _('Package "%s" removed from list').format(packageName)), 5000, 'info');
				setTimeout(function() { window.location.reload(); }, 1000);
			})
			.catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Error removing package: ') + err.message), 'error');
			});
	},
	
	handleRefresh: function(ev) {
		window.location.reload();
	},

	handleUninstallPackage: function(packageName) {
		let self = this;
		
		if (!confirm(_('Uninstall package "%s"? This will remove the package from your system.').format(packageName))) {
			return;
		}
		
		ui.showModal(_('Uninstalling...'), [
			E('p', { 'class': 'spinning' }, _('Please wait... Uninstalling package "%s"').format(packageName))
		]);
		
		fs.exec_direct('/usr/bin/opkg', ['remove', packageName])
			.catch(function() {
				return fs.exec_direct('/usr/libexec/opkg-call', ['remove', packageName])
					.catch(function() {
						return fs.exec_direct('/usr/libexec/package-manager-call', ['remove', packageName]);
					});
			})
			.then(function(result) {
				ui.hideModal();
				
				packageStates[packageName] = 'pending';
				
				let safeId = 'pkg-' + packageName.replace(/[^a-zA-Z0-9]/g, '_');
				let row = document.getElementById(safeId);
				
				if (row) {
					row.classList.remove('installed');
					
					let statusCell = row.querySelector('.td.status');
					if (statusCell) {
						statusCell.innerHTML = '';
						statusCell.appendChild(E('span', { 'class': 'status-icon pending' }, '⌛ ' + _('Waiting for installation...')));
					}
					
					let cells = row.querySelectorAll('.td');
					if (cells.length >= 4) {
						cells[3].innerHTML = '';
					}
				}
				
				popTimeout(null, E('p', {}, _('Package "%s" uninstalled successfully').format(packageName)), 5000, 'info');
			})
			.catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, E('p', {}, _('Error uninstalling package: ') + err.message), 'error');
			});
	},

	render: function(data) {
		let packages = data[0];
		let count = data[1];
		let progress = data[2];
		let installedPackages = data[3] || [];
		let self = this;

		console.log('Render data:', { packages: packages, count: count, progress: progress, installedPackagesCount: installedPackages.length });

		if (progress.active) {
			isInstalling = true;
		}

		let canInstall = count && count.count && count.count > 0;
		console.log('Can install:', canInstall, 'count:', count);

		let view = E([], [
			E('style', { 'type': 'text/css' }, [ css ]),

			E('h2', {}, _('Backup and Restore APK Packages')),

			E('div', { 'class': 'cbi-map-descr' }, 
				_('Package allows user to create a list of installed packages and reinstall packages from this list.')),
				
            E('div', {
                'style': 'display: flex; justify-content: flex-end; align-items: center; gap: .5rem; width: 100%;'
                }, [
                    E('span', {}, _('Refresh package list')),
                    E('button', {
                      'class': 'btn cbi-button-neutral',
                      'id': 'btsSearch_',
                      'click': ui.createHandlerFn(this, 'handleRefresh')
                    }, _('Refresh'))
            ]),

			E('div', { 'class': 'controls' }, [
				E('div', {}, [
					E('label', { 'id': 'progress-label' }, _('Installation progress:' )),
					E('div', { 
						'class': 'cbi-progressbar',
						'title': '',
						'id': 'main-progressbar'
					}, E('div', {}, [ '\u00a0' ]))
				]),

				E('div', {}, [
					E('label', {}, _('Number of packages in list:')),
					E('strong', { 'style': 'font-size: 1.2em;' }, count.count || 0)
				]),

				E('div', {}, [
					E('label', {}, _('Actions:')),
					E('span', { 'class': 'control-group' }, [
						E('button', { 
							'id': 'create-btn',
							'class': 'btn cbi-button-action',
							'click': ui.createHandlerFn(this, 'handleBackup')
						}, _('Create list')),
						' ',
						E('button', { 
							'id': 'install-btn',
							'class': 'btn cbi-button-positive',
							'click': ui.createHandlerFn(this, 'handleRestore'),
							'disabled': !canInstall ? true : null
						}, _('Install packages from list'))
					])
				]),

				E('div', {}, [
					E('label', {}, _('List file actions:')),
					E('span', { 'class': 'control-group' }, [
						E('button', { 
							'id': 'load-btn',
							'class': 'cbi-button cbi-button-action important',
							'click': ui.createHandlerFn(this, 'handleLoadFile')
						}, _('Load list')),
						' ',
						E('button', { 
							'id': 'edit-btn',
							'class': 'btn cbi-button-apply',
							'click': ui.createHandlerFn(this, 'handleEditFile'),
							'disabled': !canInstall ? true : null
						}, _('Edit')),
						' ',
						E('button', { 
							'id': 'save-btn',
							'class': 'btn cbi-button-neutral',
							'click': ui.createHandlerFn(this, 'handleSaveFile'),
							'disabled': !canInstall ? true : null
						}, _('Save')),
						' ',
						E('button', { 
							'id': 'clear-btn',
							'class': 'btn cbi-button-negative',
							'click': ui.createHandlerFn(this, 'handleClearList'),
							'disabled': !canInstall ? true : null
						}, _('Clear'))
					])
				])
			]),

			E('div', { 
				'id': 'install-alert',
				'class': 'operation-status'
			}, [
				E('span', { 'class': 'spinning' }, _('Please wait... installing packages from list'))
			]),

			(!packages.success || !packages.exists || !packages.packages || packages.packages.length === 0) ? 
				E('div', { 'style': 'text-align: center; padding: 3em; color: #999;' }, [
					E('p', { 'style': 'font-size: 1.2em; margin-bottom: 0.5em;' }, '📦 ' + _('No packages in list')),
					E('p', { 'style': 'margin: 0;' }, _('Click "Create list" to save installed packages'))
				])
			:
				E([], [
					E('h3', {}, _('Package list')),
					this.renderPackageTable(packages, installedPackages)
				])
		]);

		if (progress.active || progress.completed) {
			requestAnimationFrame(function() {
				let installAlert = document.getElementById('install-alert');
				if (installAlert && progress.active) {
					installAlert.style.display = 'block';
				}
				self.updateProgress(progress);
			});
		}

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
