# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and this project follows Semantic Versioning once released.

## [Unreleased]

### Added

- Initial quality and process hardening for pre-release readiness.

### Changed

- None yet.

### Fixed

- Entity errors (unknown or unterminated entity references in text and attribute values) now report the document `line`, `column` and `offset` of the offending `&` instead of `0:0` and an offset relative to the text or attribute slice ([#100](https://github.com/eclipse-aascw/xmlsax-typescript/issues/100)).
- Start tags with duplicate attributes now throw `XmlSaxError` (XML 1.0 "Unique Att Spec"), including attributes whose prefixes are bound to the same namespace URI (Namespaces in XML 1.0, section 6.3). Previously the later value silently overwrote the earlier one ([#100](https://github.com/eclipse-aascw/xmlsax-typescript/issues/100)).

### Breaking

- None yet.
