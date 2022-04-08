# Reve quantique

`systemctl status reve_quantique.service`

## Information

- For uploading a file and testing: http://10.9.8.1:8090/

- For configuring and changing playback mode: http://10.9.8.1:9090/

- For status: http://10.9.8.1:8090/status/osc

Connect your OSC app : 

    - target ip : 10.9.8.1
    - target port : 57121


## ⚠️ 

Please keep `const motorHat = {}` as en empty object. If you need to run the code without a raspberry pi please comment `motorHat` line definition and comment `import MotorHat from 'motor-hat'`. Then uncomment both lines : 

```
// const MotorHat = null
// const motorHat = null
```

Conditionnal import should be improved.

### How it works

We receive data through OSC and we manipulate the data.
The data received are an array of value. This array changes with time.
We can average and moving avarage the value.
We also have the ability to pick a speed within a range of value.

Use the `getSpeedPerRange` function to find which "tableau" should play for what value. A "tableau"
is the name for a specific speed. `getSpeedPerRange` returns a `speed`.

The set of `painting/tableau` is described like this :

```

const paintings = [{
  name: 'reve-1',
  min: -1, 
  max: -0.8,
  speed: -20
}, {
  name: 'reve-2',
  min: -0.79, 
  max: -0.4,
  speed: -15
}, {
  name: 'reve-3',
  min: -0.39, 
  max: -0.2,
  speed: -10
}, {
  name: 'reve-4',
  min: -0.19, 
  max: -0.1,
  speed: -5
}, {
  name: 'reve-5',
  min: -0.09, 
  max: 0.09,
  speed: 0
}, {
  name: 'reve-6',
  min: 0.1, 
  max: 0.19,
  speed: 5
}, {
  name: 'reve-7',
  min: 0.2, 
  max: 0.39,
  speed: 10
}, {
  name: 'reve-8',
  min: 0.4, 
  max: 0.79,
  speed: 15
}, {
  name: 'reve-9',
  min: 0.8, 
  max: 1,
  speed: 20
}]
```

So you can simply change the `speed` value and adujst `min` and `max` accordingly to the desired effect.
Use the `paintSpeed` function to use this mapping.

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

## logging removal

```
sudo service rsyslog stop
```

Then, you can disable it at boot:

```
sudo systemctl disable rsyslog
```

to enable it again at boot:

```
sudo systemctl enable rsyslog
```


## Configuration

```
df -h
du -s * | sort -nr
truncate daemon.log --size 0
rm syslog.1
truncate syslog --size 0
service rsyslog stop
systemctl disable rsyslog
vim /lib/systemd/system/reve_quantique.service
```

```
[Service]
StandardOutput=null
```

```
systemctl daemon-reload
systemctl restart reve_quantique.service
systemctl status reve_quantique.service
journalctl -fu reve_quantique.service
```

to enable it again at boot:

```
sudo systemctl enable rsyslog
```

```
[Service]
#StandardOutput=null
```



