# Do No Harm Assessment

**Project:** OpenJustice
**Type:** Open-Source Digital Public Good (DPG)
**Last Reviewed:** 2026-03-28

---

## 1. Purpose and Scope

OpenJustice is an open-source information management platform designed for public agencies operating in low-connectivity environments. It is built to be transparent, accountable, and rights-respecting by design.

This document assesses the potential risks associated with the deployment and use of OpenJustice and describes the safeguards the project has implemented to prevent misuse and protect individuals' rights. It is maintained in accordance with the Digital Public Good Alliance's requirement for a formal "Do No Harm" assessment.

---

## 2. Data Privacy Risks and Mitigations

**Risk:** Personally identifiable information (PII) stored within the system could be accessed without authorization, leading to privacy violations or harm to individuals whose records are maintained.

**Mitigations:**

- AES-256 encryption is applied to all PII at rest.
- Role-based access control enforces scope limits at four levels: own, station, region, and national.
- Audit logging captures all data access events, including the identity of the accessor, the timestamp, and the specific records viewed or modified.
- Data retention policies are configurable per deployment, allowing administering agencies to comply with local data protection regulations.

---

## 3. Access Control Risks and Mitigations

**Risk:** Privileged accounts could be misused to view, modify, or delete records outside the scope of legitimate operational need.

**Mitigations:**

- Dual authorization is required for all sensitive operations, ensuring no single individual can execute high-impact actions alone.
- Break-glass emergency access is available for critical situations but triggers immediate alerts to oversight contacts.
- No single account has unrestricted access to the system without corresponding oversight mechanisms.
- All administrative actions are logged and included in reports delivered to designated oversight contacts.

---

## 4. Data Misuse Risks and Mitigations

**Risk:** Data collected and stored by the system could be used for purposes beyond its intended scope, including unauthorized surveillance or profiling.

**Mitigations:**

- Field-level access restrictions ensure that users only see data relevant to their role and function.
- External communication channels (WhatsApp, USSD) are configured to return only non-sensitive reference data, never full PII or case details.
- The inter-agency API enforces granular scope permissions and requires approval workflows before access is granted.
- The audit trail tracks which specific fields were accessed and by whom, enabling detection of access patterns that fall outside normal operational use.

---

## 5. Vulnerable Population Protections

**Risk:** The system may hold sensitive information about vulnerable individuals, including minors, victims of violence, or displaced persons. This data requires safeguards beyond standard privacy controls.

**Mitigations:**

- All PII is encrypted at rest, with additional access restrictions applied to records flagged as sensitive.
- External communication channels apply automatic redaction to prevent leakage of sensitive details.
- Biometric data collection is disabled by default. Enabling it requires documented legal authorization specific to the deployment jurisdiction.
- Consent logging is built into the data collection workflow, recording when and how consent was obtained.

---

## 6. Accountability and Oversight

**Risk:** Without independent oversight, the system could be operated in ways that lack accountability, undermining public trust and enabling misuse.

**Mitigations:**

- An independent auditor role provides read-only access to audit logs without access to operational data, enabling external review without compromising case confidentiality.
- Audit logs are hash-chained to provide tamper detection. Any modification to historical log entries is cryptographically detectable.
- An anonymous integrity reporting channel is available for internal stakeholders to raise concerns without fear of retaliation.
- Automated anomaly detection flags unusual access patterns for review by oversight personnel.

---

## 7. Platform Independence and Vendor Lock-in

**Risk:** Dependence on proprietary vendors or platforms could limit data sovereignty, create unsustainable cost structures, or restrict the ability of deploying agencies to maintain control over their own data.

**Mitigations:**

- OpenJustice is built entirely on open-source technologies, including PostgreSQL, NestJS, and Next.js.
- Storage is S3-compatible, allowing deployment with any compliant provider, including self-hosted options.
- A documented export schema supports full data portability, enabling agencies to migrate away from OpenJustice at any time without data loss.
- The project is released under the MIT license, ensuring no vendor lock-in at the licensing level.

---

## 8. Content and AI Risks

OpenJustice does not incorporate AI or machine learning for decision-making, scoring, profiling, or predictive analytics. All decisions within the system are made by human operators.

The platform functions exclusively as a record-keeping and information management tool. It does not generate recommendations, risk scores, or automated assessments that could influence outcomes for individuals whose data is stored within it.

---

## 9. Review Process

- All new features are reviewed against this assessment before they are merged into the main branch.
- The maintainer team evaluates whether proposed features could introduce new risks to data privacy, access control, vulnerable populations, or accountability.
- This document is reviewed annually and updated as the project evolves, new features are introduced, or new risks are identified.

---

## 10. Conclusion

OpenJustice is designed with a "do no harm" philosophy at its core. Every feature that handles sensitive data includes corresponding safeguards to prevent misuse and protect the rights of individuals whose information is managed by the system.

The project prioritizes transparency, accountability, and rights protection over feature velocity. Safeguards are not treated as optional additions but as integral requirements for every component of the platform.
