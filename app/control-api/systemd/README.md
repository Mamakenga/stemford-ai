# Control API watchdog timer

This directory stores the managed `systemd` units for the stalled-task watchdog.

## Install on VPS

```bash
sudo cp /opt/stemford/app/control-api/systemd/stemford-stall-watchdog.service /etc/systemd/system/
sudo cp /opt/stemford/app/control-api/systemd/stemford-stall-watchdog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stemford-stall-watchdog.timer
sudo systemctl list-timers --all | grep stemford-stall-watchdog
```

## Disable old cron entry (if present)

```bash
crontab -u stemford -l | grep -v 'stall_watchdog.sh' | crontab -u stemford -
```
