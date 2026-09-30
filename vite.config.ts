import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';  
import manifest from './src/manifest.json';
//Lo que se hace con el import manifest es leer el archivo manifest.json, convertirlo en un objeto de JS y guardarlo en
//la variable manifest

export default defineConfig ({
    plugins: [
        crx({ manifest: manifest as any }),
    ],
});