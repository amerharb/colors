import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig({
	plugins: [react()],
	define: {
		// expose the app version to the client (used in the settings About section)
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	server: {
		port: 3000,
	},
})
