# Approved security and compliance claims

Copy verbatim. Anything not here goes to Jira SECQ.

- Northwind Pay is validated as a PCI-DSS Level 1 Service Provider.
- Northwind Pay maintains a SOC 2 Type II report covering Security, Availability and Confidentiality.
- Customer data is encrypted in transit with TLS 1.2 or higher and at rest with AES-256.
- Card data is tokenized; our application services outside the cardholder data environment never see full card numbers.
- Production access requires SSO, multi-factor authentication and just-in-time approval, and is logged.
- We run third-party penetration tests at least annually. Summaries are available under NDA.
- Deposits are held at Harbor Trust Bank, Member FDIC.
