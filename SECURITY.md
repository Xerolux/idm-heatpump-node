# Security

Please report vulnerabilities privately through GitHub Security Advisories for
this repository. Do not include heat-pump PINs, credentials, private network
addresses, serial numbers, or raw device captures in public issues.

Modbus TCP has no built-in TLS or authentication. Use the client only inside a
trusted, segmented local network. Review every write with `simulateWrite()` or
a dry run first; live hardware writes are never part of automated tests.

Security fixes that change public behavior must first be reconciled with
`Xerolux/idm-heatpump-api`, then regenerated and verified against the exact
baseline in `UPSTREAM-PARITY.json`.
