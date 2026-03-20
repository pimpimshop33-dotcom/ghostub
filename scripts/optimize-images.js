/**
 * Script d'optimisation des images pour Ghostub
 * Exécuter : node scripts/optimize-images.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // npm install sharp

const IMAGES_DIR = path.join(__dirname, '../assets');
const OUTPUT_DIR = path.join(__dirname, '../ghostub');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const sourceIcon = path.join(IMAGES_DIR, 'icon-source.png');

async function generateIcons() {
  if (!fs.existsSync(sourceIcon)) {
    console.log('Source icon not found, skipping...');
    return;
  }
  
  for (const size of sizes) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    await sharp(sourceIcon)
      .resize(size, size)
      .png({ quality: 85 })
      .toFile(outputPath);
    console.log(`Generated icon-${size}.png`);
  }
}

async function optimizeScreenshots() {
  const screenshots = ['screenshot-1.png', 'screenshot-2.png', 'screenshot-3.png'];
  
  for (const file of screenshots) {
    const sourcePath = path.join(IMAGES_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);
    
    if (fs.existsSync(sourcePath)) {
      await sharp(sourcePath)
        .resize(1080, 1920, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(outputPath);
      console.log(`Optimized ${file}`);
    }
  }
}

async function main() {
  console.log('Starting image optimization...');
  await generateIcons();
  await optimizeScreenshots();
  console.log('Done!');
}

main().catch(console.error);
