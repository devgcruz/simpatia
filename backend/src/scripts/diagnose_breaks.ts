import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Attempt to load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log('=== DIAGNOSIS STARTED ===');

    const doctors = await prisma.doutor.findMany({
        where: { ativo: true },
        select: {
            id: true,
            nome: true,
            email: true,
            pausaInicio: true,
            pausaFim: true,
            pausaExcecoes: {
                where: { ativo: true },
                select: {
                    id: true,
                    data: true,
                    pausaInicio: true,
                    pausaFim: true
                }
            },
            horarios: {
                where: { ativo: true },
                select: {
                    diaSemana: true,
                    inicio: true,
                    fim: true,
                    pausaInicio: true,
                    pausaFim: true
                }
            }
        }
    });

    console.log(`Found ${doctors.length} active doctors.`);

    for (const doc of doctors) {
        console.log(`\nDoctor: ${doc.nome} (ID: ${doc.id})`);
        console.log(`  Default Break (Doutor): "${doc.pausaInicio}" - "${doc.pausaFim}"`);

        if (doc.pausaExcecoes.length > 0) {
            console.log(`  Exceptions:`);
            for (const ex of doc.pausaExcecoes) {
                const dateStr = ex.data instanceof Date ? ex.data.toISOString().split('T')[0] : ex.data;
                console.log(`    - Date: ${dateStr} => ${ex.pausaInicio} - ${ex.pausaFim}`);
            }
        } else {
            console.log(`  No exceptions.`);
        }

        if (doc.horarios.length > 0) {
            console.log(`  Weekly Schedule (Horarios):`);
            doc.horarios.forEach(h => {
                // Handle nulls for display
                const pInicio = h.pausaInicio || 'None';
                const pFim = h.pausaFim || 'None';
                console.log(`    Day ${h.diaSemana}: ${h.inicio}-${h.fim} (Break: "${pInicio}" - "${pFim}")`);
            });
        } else {
            console.log(`  No weekly schedule.`);
        }
    }
    console.log('\n=== DIAGNOSIS FINISHED ===');
}

main()
    .catch((e) => {
        console.error('Error running diagnosis:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
