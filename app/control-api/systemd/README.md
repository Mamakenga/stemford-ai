# Control API systemd units

This directory stores managed `systemd` units for periodic maintenance jobs.

## Install on VPS

```bash
sudo cp /opt/stemford/app/control-api/systemd/stemford-stall-watchdog.service /etc/systemd/system/
sudo cp /opt/stemford/app/control-api/systemd/stemford-stall-watchdog.timer /etc/systemd/system/
sudo cp /opt/stemford/app/control-api/systemd/stemford-memory-cards-maintenance.service /etc/systemd/system/
sudo cp /opt/stemford/app/control-api/systemd/stemford-memory-cards-maintenance.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stemford-stall-watchdog.timer
sudo systemctl enable --now stemford-memory-cards-maintenance.timer
sudo systemctl list-timers --all | grep stemford-stall-watchdog
sudo systemctl list-timers --all | grep stemford-memory-cards-maintenance
```

## Disable old cron entry (if present)

```bash
crontab -u stemford -l | grep -v 'stall_watchdog.sh' | crontab -u stemford -
```

## Manual one-shot checks

```bash
sudo systemctl start stemford-stall-watchdog.service
sudo systemctl start stemford-memory-cards-maintenance.service
sudo journalctl -u stemford-memory-cards-maintenance.service -n 20 --no-pager
```
