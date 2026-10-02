#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, 'image_tools', 'node_modules', 'sharp'));

async function trimDirectory(dirPath, targetSize = 256, padding = 8) {
    if (!fs.existsSync(dirPath)) {
        console.error(`Directory does not exist: ${dirPath}`);
        return;
    }

    const files = fs.readdirSync(dirPath).filter((file) => /\.(webp|png)$/i.test(file));
    console.log(`\n🔍 Found ${files.length} images in: ${dirPath}\n`);

    let processed = 0;

    const processFile = async (file) => {
        const filePath = path.join(dirPath, file);
        try {
            const inputBuffer = fs.readFileSync(filePath);
            const metadata = await sharp(inputBuffer).metadata();

            // 1. Trim transparent / blank pixels around the bounding box
            const trimmedBuffer = await sharp(inputBuffer)
                .trim({ threshold: 5 })
                .toBuffer();

            const trimmedMeta = await sharp(trimmedBuffer).metadata();

            // 2. Fit into a clean square canvas with subtle 4px padding so it fills 96% of frame
            const innerSize = Math.max(16, targetSize - (padding * 2));
            
            const finalBuffer = await sharp(trimmedBuffer)
                .resize({
                    width: innerSize,
                    height: innerSize,
                    fit: 'inside',
                    withoutEnlargement: false,
                })
                .extend({
                    top: padding,
                    bottom: padding,
                    left: padding,
                    right: padding,
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .webp({
                    quality: 95,
                    effort: 4,
                })
                .toBuffer();

            fs.writeFileSync(filePath, finalBuffer);
            processed++;
            console.log(`✅ [${processed}/${files.length}] ${file}: ${metadata.width}x${metadata.height} ➔ trimmed ${trimmedMeta.width}x${trimmedMeta.height}`);
        } catch (err) {
            console.error(`❌ Failed to process ${file}:`, err.message);
        }
    };

    // Parallel processing with concurrency limit of 10
    const CHUNK_SIZE = 10;
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
        const chunk = files.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(processFile));
    }

    console.log(`\n🎉 Processed ${processed}/${files.length} icons successfully in: ${dirPath}\n`);
}

async function main() {
    const args = process.argv.slice(2);
    const defaultAssetsDir = path.resolve(__dirname, '..', 'resources', '[sunset]', 'sunset_ui', 'web', 'assets', 'items');
    const newItemsDir = path.resolve(__dirname, '..', '..', 'newitems');

    const targetDirs = args.length > 0 ? args : [defaultAssetsDir, newItemsDir];

    for (const dir of targetDirs) {
        if (fs.existsSync(dir)) {
            await trimDirectory(dir);
        }
    }
}

main().catch(console.error);
