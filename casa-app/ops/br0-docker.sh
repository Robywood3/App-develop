#!/usr/bin/env bash
# Docker sets the FORWARD policy to DROP. With br_netfilter active this also drops the
# traffic of the HA VM on the bridge br0 (section 10, step 3). Allow it explicitly.
# Run once as root; ops/systemd/br0-docker.service re-applies it at every boot.
set -euo pipefail
iptables -C DOCKER-USER -i br0 -o br0 -j ACCEPT 2>/dev/null || iptables -I DOCKER-USER -i br0 -o br0 -j ACCEPT
echo "Traffico sul ponte br0 consentito."
