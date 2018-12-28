# cni-bridge

usage:

create file mybridge.conf:
```json
{
    "cniVersion": "0.3.1",
    "name": "mybridge",
    "type": "bridge",
    "bridge": "cni_bridge0",
    "isGateway": true,
    "ipMasq": true,
    "ipam": {
        "type": "dhcp"
    }
}
```
execute command in shell:
```sh
% sudo cat mybridge.conf | sudo env CNI_COMMAND="ADD" CNI_CONTAINERID=1 CNI_IFNAME=eth0 CNI_PATH=`pwd` ./bridge | jq
```
