import { Jimp } from 'jimp';

async function analyze() {
    const image = await Jimp.read('public/bg-map_mask.jpg');
    console.log(`Image size: ${image.bitmap.width}x${image.bitmap.height}`);
    
    let black = 0;
    let white = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    let yellow = 0;
    let other = 0;
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        
        // Simple thresholding
        const threshold = 128;
        const isR = r > threshold;
        const isG = g > threshold;
        const isB = b > threshold;
        
        if (!isR && !isG && !isB) black++;
        else if (isR && isG && isB) white++;
        else if (isR && !isG && !isB) red++;
        else if (!isR && isG && !isB) green++;
        else if (!isR && !isG && isB) blue++;
        else if (isR && isG && !isB) yellow++;
        else other++;
    });

    console.log(`Black (Sea): ${black}`);
    console.log(`White (Plains): ${white}`);
    console.log(`Red (Volcano): ${red}`);
    console.log(`Green (Forest): ${green}`);
    console.log(`Blue (Snow): ${blue}`);
    console.log(`Yellow (Desert): ${yellow}`);
    console.log(`Other: ${other}`);
}

analyze().catch(console.error);
