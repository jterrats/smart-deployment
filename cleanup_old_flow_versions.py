#!/usr/bin/env python3
"""
Automatic Flow Version Cleanup for CI/CD

Prevents hitting Salesforce flow version limits by keeping only last N versions.
Runs automatically before each deploy.

Usage in CI/CD:
    python cleanup_old_flow_versions.py --org ${ENV_NAME} --keep 5
"""

import argparse
import subprocess
import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

def run_sf_query(org: str, query: str) -> dict:
    """Execute Salesforce Tooling API query"""
    cmd = ['sf', 'data', 'query', '--query', query, '--target-org', org, '--use-tooling-api', '--json']
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return None

    return json.loads(result.stdout)

def get_flow_versions(org: str, keep: int) -> dict:
    """Get flows that exceed version limit"""
    print(f"🔍 Checking flow versions in {org}...")

    # Query FlowDefinition
    query = "SELECT DeveloperName FROM FlowDefinition"
    result = run_sf_query(org, query)

    if not result or result['status'] != 0:
        print("  ⚠️  Could not query flows")
        return {}

    flow_names = [r['DeveloperName'] for r in result['result']['records']]
    flows_to_cleanup = {}

    for flow_name in flow_names:
        query = f"SELECT VersionNumber FROM Flow WHERE DefinitionDeveloperName = '{flow_name}' ORDER BY VersionNumber DESC"
        result = run_sf_query(org, query)

        if result and result['status'] == 0 and result['result']['records']:
            versions = [r['VersionNumber'] for r in result['result']['records']]

            if len(versions) > keep:
                versions_to_delete = versions[keep:]  # Delete old ones, keep newest
                flows_to_cleanup[flow_name] = versions_to_delete

    return flows_to_cleanup

def generate_destructive_xml(flows_to_delete: dict, env: str) -> Path:
    """Generate destructiveChanges.xml"""
    if not flows_to_delete:
        return None

    output_dir = Path(f"destructiveChanges/{env}")
    output_dir.mkdir(parents=True, exist_ok=True)

    ns_uri = 'http://soap.sforce.com/2006/04/metadata'
    ET.register_namespace('', ns_uri)

    # destructiveChanges.xml
    root = ET.Element('Package', xmlns=ns_uri)
    types_elem = ET.SubElement(root, 'types')

    for flow_name, versions in sorted(flows_to_delete.items()):
        for version in sorted(versions):
            member = ET.SubElement(types_elem, 'members')
            member.text = f"{flow_name}-{version}"

    name_elem = ET.SubElement(types_elem, 'name')
    name_elem.text = 'Flow'

    version_elem = ET.SubElement(root, 'version')
    version_elem.text = '65.0'

    tree = ET.ElementTree(root)
    ET.indent(tree, space='    ')

    dest_file = output_dir / "flowVersionCleanup.xml"
    tree.write(dest_file, encoding='UTF-8', xml_declaration=True)

    # package.xml
    pkg_root = ET.Element('Package', xmlns=ns_uri)
    pkg_version = ET.SubElement(pkg_root, 'version')
    pkg_version.text = '65.0'

    pkg_tree = ET.ElementTree(pkg_root)
    ET.indent(pkg_tree, space='    ')
    pkg_tree.write(output_dir / "package.xml", encoding='UTF-8', xml_declaration=True)

    return dest_file

def main():
    parser = argparse.ArgumentParser(description="Cleanup old flow versions")
    parser.add_argument('--org', required=True, help='Target org alias')
    parser.add_argument('--keep', type=int, default=5, help='Number of versions to keep')
    args = parser.parse_args()

    print(f"🧹 Flow Version Cleanup (keep last {args.keep})")

    flows_to_delete = get_flow_versions(args.org, args.keep)

    if not flows_to_delete:
        print("  ✅ All flows within version limits")
        return

    total_to_delete = sum(len(v) for v in flows_to_delete.values())
    print(f"  ⚠️  Found {len(flows_to_delete)} flows exceeding limit")
    print(f"  🗑️  Will delete {total_to_delete} old versions")

    for flow_name, versions in sorted(flows_to_delete.items()):
        print(f"    - {flow_name}: delete v{min(versions)}-v{max(versions)}")

    dest_file = generate_destructive_xml(flows_to_delete, args.org)

    if dest_file:
        print(f"\n✅ Generated: {dest_file}")

        # Execute cleanup
        print(f"🚀 Executing cleanup...")
        cmd = [
            'sf', 'project', 'deploy', 'start',
            '--manifest', str(dest_file.parent / 'package.xml'),
            '--post-destructive-changes', str(dest_file),
            '--test-level', 'NoTestRun',
            '--purge-on-delete',
            '-o', args.org
        ]

        result = subprocess.run(cmd)

        if result.returncode == 0:
            print("✅ Flow version cleanup complete!")
        else:
            print("⚠️  Cleanup had issues (may be OK if versions are in use)")

if __name__ == "__main__":
    main()
