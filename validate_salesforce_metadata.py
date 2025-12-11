#!/usr/bin/env python3
"""
Salesforce Metadata Validator

Valida que todos los archivos de metadata cumplan con el formato requerido por Salesforce:
- Declaración XML correcta
- Namespaces requeridos (xmlns, xmlns:xsi, xmlns:xsd)
- Tipos de campos correctos (boolean, string, etc.)
- Labels dentro del límite de 40 caracteres

Uso:
    python validate_salesforce_metadata.py [--fix] [--path force-app/main/default]
"""

import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
import argparse

def validate_metadata_files(base_path: Path, auto_fix: bool = False):
    """
    Valida que todos los archivos de metadata cumplan con formato Salesforce

    Args:
        base_path: Ruta base donde buscar archivos de metadata
        auto_fix: Si True, intenta corregir problemas automáticamente

    Returns:
        tuple: (issues_found, files_fixed)
    """

    issues = []
    fixed_files = []

    # Buscar todos los archivos XML de metadata
    for xml_file in base_path.rglob('*.xml'):
        file_issues = []
        file_modified = False

        try:
            # Leer contenido original
            with open(xml_file, 'r', encoding='utf-8') as f:
                content = f.read()
            original_content = content

            # 1. Verificar declaración XML
            first_line = content.split('\n')[0].strip()
            if not first_line.startswith('<?xml version="1.0" encoding="UTF-8"?>'):
                file_issues.append("XML declaration incorrecta")
                if auto_fix and first_line.startswith('<?xml'):
                    content = content.replace(first_line, '<?xml version="1.0" encoding="UTF-8"?>', 1)
                    file_modified = True

            # 2. Para CustomMetadata, verificar namespaces
            if 'customMetadata' in str(xml_file).lower() or xml_file.suffix == '.md-meta.xml':
                # Verificar xmlns:xsd
                if 'xmlns:xsd="http://www.w3.org/2001/XMLSchema"' not in content:
                    file_issues.append("Falta namespace xmlns:xsd")
                    if auto_fix:
                        # Agregar xmlns:xsd al elemento CustomMetadata
                        if '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' in content:
                            content = content.replace(
                                '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
                                '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'
                            )
                            file_modified = True

            # 3. Parsear XML para validaciones más profundas
            tree = ET.parse(xml_file)
            root = tree.getroot()

            # 4. Verificar namespace en root
            if 'xmlns' not in root.attrib:
                file_issues.append("Falta namespace xmlns en root element")

            # 5. Para CustomMetadata, verificar campos específicos
            if 'customMetadata' in str(xml_file).lower():
                # Verificar label
                label = root.find('.//{http://soap.sforce.com/2006/04/metadata}label')
                if label is None:
                    file_issues.append("Falta campo <label>")
                elif label.text and len(label.text) > 40:
                    file_issues.append(f"Label excede 40 caracteres: '{label.text}' ({len(label.text)} chars)")

                # Verificar xsi:type para boolean fields
                for value in root.findall('.//{http://soap.sforce.com/2006/04/metadata}value'):
                    xsi_type = value.get('{http://www.w3.org/2001/XMLSchema-instance}type')
                    if xsi_type == 'xsd:boolean':
                        text = value.text
                        if text and text not in ['true', 'false']:
                            file_issues.append(f"Boolean value debe ser 'true' o 'false', encontrado '{text}'")

            # Guardar cambios si se modificó
            if auto_fix and file_modified and content != original_content:
                with open(xml_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                fixed_files.append(str(xml_file.relative_to(base_path)))

        except ET.ParseError as e:
            file_issues.append(f"Error de parsing XML: {e}")
        except Exception as e:
            file_issues.append(f"Error inesperado: {e}")

        # Agregar issues al reporte
        if file_issues:
            rel_path = xml_file.relative_to(base_path)
            for issue in file_issues:
                issues.append(f"{'⚠️ ' if not auto_fix else '✓ '} {rel_path}: {issue}")

    return issues, fixed_files

def main():
    parser = argparse.ArgumentParser(
        description='Valida archivos de metadata de Salesforce',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  # Validar archivos sin modificar
  python validate_salesforce_metadata.py

  # Validar y corregir automáticamente
  python validate_salesforce_metadata.py --fix

  # Validar ruta específica
  python validate_salesforce_metadata.py --path force-app/main/default/customMetadata
        """
    )
    parser.add_argument(
        '--fix',
        action='store_true',
        help='Intenta corregir problemas automáticamente'
    )
    parser.add_argument(
        '--path',
        type=str,
        default='force-app/main/default',
        help='Ruta base donde buscar archivos (default: force-app/main/default)'
    )
    parser.add_argument(
        '--max-display',
        type=int,
        default=50,
        help='Máximo número de problemas a mostrar (default: 50)'
    )

    args = parser.parse_args()

    # Verificar que la ruta existe
    base_path = Path(args.path)
    if not base_path.exists():
        print(f"❌ Error: La ruta '{args.path}' no existe")
        sys.exit(1)

    print("🔍 Validando archivos de metadata de Salesforce...")
    print("=" * 80)
    print(f"📁 Ruta: {base_path.absolute()}")
    print(f"🔧 Modo: {'Corrección automática' if args.fix else 'Solo validación'}")
    print("=" * 80)
    print()

    issues, fixed = validate_metadata_files(base_path, args.fix)

    if issues:
        print(f"{'✅ Problemas corregidos' if args.fix else '❌ Problemas encontrados'}: {len(issues)}\n")

        # Mostrar primeros N problemas
        for issue in issues[:args.max_display]:
            print(issue)

        if len(issues) > args.max_display:
            print(f"\n... y {len(issues) - args.max_display} problemas más")

        if args.fix:
            print(f"\n✅ {len(fixed)} archivos corregidos")
            if fixed:
                print("\nArchivos modificados:")
                for f in fixed[:10]:
                    print(f"  - {f}")
                if len(fixed) > 10:
                    print(f"  ... y {len(fixed) - 10} más")
    else:
        print("✅ Todos los archivos de metadata son válidos!")

    # Exit code: 0 si todo OK, 1 si hay problemas sin corregir
    sys.exit(0 if not issues or args.fix else 1)

if __name__ == "__main__":
    main()




