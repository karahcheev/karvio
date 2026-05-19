from enum import Enum


class TestCaseExportFormat(str, Enum):
    """Export targets accepted by popular test management systems."""

    csv = "csv"
    testlink_xml = "testlink_xml"
    xray_json = "xray_json"
    native_json = "native_json"
    junit_xml = "junit_xml"
