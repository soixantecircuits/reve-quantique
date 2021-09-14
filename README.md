# Reve quantique

`systemctl status reve_quantique.service`

## Information


## Service unit for reve quantique

```
cd /lib/systemd/system
vim /lib/systemd/system/reve_quantique.service

[Unit]
Description=Reve quantique controll motor and use OSC
Documentation=https://github.com/soixantecircuits/reve-quantique
After=network.target

[Service]
Type=simple
User=player
WorkingDirectory=/opt/bin/reve-quantique
ExecStart=/opt/player/.nvm/versions/node/v14.17.6/bin/node /opt/bin/reve-quantique/index.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Adding service to systemd

`systemctl daemon-reload`

Enable at start
`systemctl enable reve_quantique.service`



