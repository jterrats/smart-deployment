#!/usr/bin/env python3
"""
Smart Custom Metadata Batch Deployment
Divide y conquista: Deploy customMetadata en batches inteligentes
evitando límites de deployment de Salesforce
"""

import os
import sys
import subprocess
import time
from pathlib import Path
from typing import List, Dict
import xml.etree.ElementTree as ET

# Configuración
BATCH_SIZE = 200  # Número máximo de archivos por batch
METADATA_DIR = Path("force-app/main/default/customMetadata")
TEMP_DIR = Path("/tmp/sf_metadata_batches")


class CustomMetadataBatchDeployer:
    def __init__(self, target_org: str, dry_run: bool = False):
        self.target_org = target_org
        self.dry_run = dry_run
        self.deployed_count = 0
        self.failed_count = 0
        self.batch_results = []

    def analyze_metadata(self) -> Dict[str, List[Path]]:
        """Analiza y agrupa archivos de metadata por tipo"""
        print("🔍 Analizando archivos de Custom Metadata...")

        types = {}
        for xml_file in METADATA_DIR.glob("*.xml"):
            type_name = xml_file.name.split('.')[0]
            if type_name not in types:
                types[type_name] = []
            types[type_name].append(xml_file)

        # Ordenar tipos por tamaño (pequeños primero)
        types = dict(sorted(types.items(), key=lambda x: len(x[1])))

        print(f"\n📊 Resumen de Custom Metadata Types:")
        print(f"{'Tipo':<40} {'Archivos':>10}")
        print("=" * 52)
        for type_name, files in types.items():
            print(f"{type_name:<40} {len(files):>10}")
        print("=" * 52)
        print(f"{'TOTAL':<40} {sum(len(f) for f in types.values()):>10}")
        print()

        return types

    def create_batches(self, types: Dict[str, List[Path]]) -> List[Dict]:
        """Crea batches inteligentes respetando el límite de archivos"""
        batches = []
        batch_num = 1

        for type_name, files in types.items():
            file_count = len(files)

            if file_count <= BATCH_SIZE:
                # Tipo completo en un solo batch - usar nombres específicos
                members = [f.stem.replace('.md-meta', '') for f in files]

                batches.append({
                    'number': batch_num,
                    'type': type_name,
                    'pattern': 'specific',
                    'members': members,
                    'file_count': file_count,
                    'description': f"Deploy all {type_name}"
                })
                batch_num += 1
            else:
                # Dividir tipo grande en sub-batches
                sub_batch_num = 1
                for i in range(0, file_count, BATCH_SIZE):
                    batch_files = files[i:i + BATCH_SIZE]

                    # Extraer nombres específicos de archivos
                    members = [f.stem.replace('.md-meta', '') for f in batch_files]

                    batches.append({
                        'number': batch_num,
                        'type': type_name,
                        'pattern': 'specific',
                        'members': members,
                        'file_count': len(batch_files),
                        'description': f"Deploy {type_name} (part {sub_batch_num}/{(file_count + BATCH_SIZE - 1) // BATCH_SIZE})"
                    })

                    batch_num += 1
                    sub_batch_num += 1

        return batches

    def create_manifest(self, batch: Dict, manifest_path: Path):
        """Crea un package.xml para el batch"""
        root = ET.Element('Package')
        root.set('xmlns', 'http://soap.sforce.com/2006/04/metadata')

        types_elem = ET.SubElement(root, 'types')

        # Lista específica de miembros (siempre)
        for member in batch['members']:
            member_elem = ET.SubElement(types_elem, 'members')
            member_elem.text = member

        name_elem = ET.SubElement(types_elem, 'name')
        name_elem.text = 'CustomMetadata'

        version_elem = ET.SubElement(root, 'version')
        version_elem.text = '65.0'

        # Formatear XML con indentación
        ET.indent(root, space='    ')
        tree = ET.ElementTree(root)
        tree.write(manifest_path, encoding='UTF-8', xml_declaration=True)

    def deploy_batch(self, batch: Dict, manifest_path: Path) -> bool:
        """Ejecuta el deploy de un batch"""
        print(f"\n{'='*60}")
        print(f"📦 Batch #{batch['number']}: {batch['description']}")
        print(f"{'='*60}")
        print(f"Archivos: {batch['file_count']}")
        print(f"Manifest: {manifest_path.name}")

        cmd = [
            'sf', 'project', 'deploy', 'start',
            '--manifest', str(manifest_path),
            '--target-org', self.target_org
        ]

        if self.dry_run:
            cmd.append('--dry-run')
            print("🔍 Modo DRY-RUN activado")

        print(f"\n🚀 Ejecutando: {' '.join(cmd)}\n")

        try:
            result = subprocess.run(
                cmd,
                capture_output=False,
                text=True,
                check=True
            )

            print(f"\n✅ Batch #{batch['number']}: SUCCESS")
            self.deployed_count += batch['file_count']
            self.batch_results.append({
                'batch': batch['number'],
                'status': 'SUCCESS',
                'files': batch['file_count']
            })
            return True

        except subprocess.CalledProcessError as e:
            print(f"\n❌ Batch #{batch['number']}: FAILED")
            print(f"Error code: {e.returncode}")
            self.failed_count += batch['file_count']
            self.batch_results.append({
                'batch': batch['number'],
                'status': 'FAILED',
                'files': batch['file_count'],
                'error': str(e)
            })
            return False

    def deploy_all(self):
        """Ejecuta el deployment completo en batches"""
        print("\n" + "="*60)
        print("🚀 CUSTOM METADATA BATCH DEPLOYMENT")
        print("="*60)
        print(f"Target Org: {self.target_org}")
        print(f"Batch Size: {BATCH_SIZE} archivos")
        print(f"Dry Run: {self.dry_run}")
        print()

        # Crear directorio temporal
        TEMP_DIR.mkdir(parents=True, exist_ok=True)

        # Analizar metadata
        types = self.analyze_metadata()

        # Crear batches
        batches = self.create_batches(types)
        total_batches = len(batches)

        print(f"\n📋 Se crearán {total_batches} batches para deployment\n")

        if not self.dry_run:
            response = input("¿Continuar con el deployment? (y/n): ")
            if response.lower() != 'y':
                print("❌ Deployment cancelado por el usuario")
                return

        # Deployar cada batch
        start_time = time.time()

        for batch in batches:
            manifest_path = TEMP_DIR / f"batch_{batch['number']:03d}_{batch['type']}.xml"
            self.create_manifest(batch, manifest_path)

            success = self.deploy_batch(batch, manifest_path)

            if not success and not self.dry_run:
                response = input("\n⚠️  Batch falló. ¿Continuar con el siguiente? (y/n): ")
                if response.lower() != 'y':
                    print("❌ Deployment detenido por el usuario")
                    break

            # Pausa entre batches para evitar row locks
            if batch['number'] < total_batches:
                wait_time = 5 if self.dry_run else 15
                print(f"\n⏸️  Esperando {wait_time} segundos antes del siguiente batch...")
                time.sleep(wait_time)

        # Resumen final
        elapsed_time = time.time() - start_time
        self.print_summary(elapsed_time)

    def print_summary(self, elapsed_time: float):
        """Imprime resumen del deployment"""
        print("\n" + "="*60)
        print("📊 RESUMEN DEL DEPLOYMENT")
        print("="*60)

        success_batches = sum(1 for r in self.batch_results if r['status'] == 'SUCCESS')
        failed_batches = sum(1 for r in self.batch_results if r['status'] == 'FAILED')

        print(f"Batches exitosos: {success_batches}")
        print(f"Batches fallidos: {failed_batches}")
        print(f"Total batches: {len(self.batch_results)}")
        print()
        print(f"Archivos deployed: {self.deployed_count}")
        print(f"Archivos fallidos: {self.failed_count}")
        print()
        print(f"Tiempo total: {elapsed_time/60:.1f} minutos")
        print(f"Directorio temporal: {TEMP_DIR}")
        print()

        if failed_batches == 0:
            print("✅ ¡Deployment completado exitosamente!")
        else:
            print("⚠️  Algunos batches fallaron:")
            for result in self.batch_results:
                if result['status'] == 'FAILED':
                    print(f"  - Batch #{result['batch']}: {result['files']} archivos")


def main():
    if len(sys.argv) < 2:
        print("Uso: python deploy_custom_metadata_smart_batches.py <target-org> [--dry-run]")
        print("\nEjemplo:")
        print("  python deploy_custom_metadata_smart_batches.py jterrats@salesforce.com.grg.prod.uat")
        print("  python deploy_custom_metadata_smart_batches.py jterrats@salesforce.com.grg.prod.uat --dry-run")
        sys.exit(1)

    target_org = sys.argv[1]
    dry_run = '--dry-run' in sys.argv

    deployer = CustomMetadataBatchDeployer(target_org, dry_run)
    deployer.deploy_all()


if __name__ == '__main__':
    main()

