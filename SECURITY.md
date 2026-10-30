# Security policy

PortaRegulus publishes PortaRegulus Risk as free and open-source software. We act as its open-source software steward under Article 24 of Regulation (EU) 2024/2847 (Cyber Resilience Act), on a voluntary basis (ADR-0003). This file is our cybersecurity policy for coordinated vulnerability disclosure.

## Scope

1. The source code in this repository.
2. The release bundles that we publish on the GitHub releases page.
3. The hosted origin https://risk.portaregulus.com and its HTTP headers.

Not in scope.

1. A web server that a user operates to self-host the bundle.
2. Denial of service with high traffic against the hosted origin.
3. Findings that need a browser extension with "read all sites" rights, or physical access to an unlocked computer.

## How to report

Use GitHub private vulnerability reporting at https://github.com/porta-regulus/pr-risk/security/advisories/new.

If you cannot use GitHub, send an e-mail to security@portaregulus.com.

Tell us these items.

1. The version and the build hash. The app shows them at the bottom of the start screen.
2. The steps to reproduce the problem.
3. The impact as you see it.

Do not send real risk registers. Use the example files in `docs/schema/examples/`.

## What we do

| Step | Time limit |
|---|---|
| We confirm that we received the report. | 5 working days |
| We give a first assessment and a CVSS 4.0 score. | 10 working days |
| We release a fix or a mitigation. | 90 days, shorter for a vulnerability that is actively exploited |
| We publish a GitHub security advisory and request a CVE. | When the fix is released |

We tell you about progress at each step. We name you in the advisory, unless you ask us not to.

A security fix comes as its own patch release, with no new functions, when this is technically possible. The release notes and the advisory tell users what to do.

If the vulnerability is in a third-party component, we report it to the maintainers of that component and tell you that we did. We also release a fix or a mitigation for this software.

The app makes no network request, so it cannot tell you about a fix. To learn about fixes, watch the releases of https://github.com/porta-regulus/pr-risk. The hosted app at https://risk.portaregulus.com loads a new version when you next start it.

If we find that a vulnerability in this software is actively exploited, we report it as Article 14(1) of the Cyber Resilience Act requires, to the extent that Article 24(3) applies it to stewards.

## Supported versions

Only the latest release gets security fixes. Before release 1, only the `main` branch gets fixes.

## Safe harbour

We do not take legal action against research in good faith that follows this policy. Do not access data of other persons. Do not degrade the hosted origin for other users. Do not use social engineering. Give us a reasonable time to fix the problem before you publish it.
