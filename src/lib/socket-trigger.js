export async function triggerSocketUpdate(source = 'unknown') {
    try {
        if (typeof global !== 'undefined' && global.io) {
            global.io.emit('OCCUPANCY_UPDATE', { timestamp: Date.now(), source });
            console.log(`Direct socket trigger successful from source: ${source}`);
            return;
        }
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await fetch(`${baseUrl}/api/trigger-update`, {
            method: 'POST',
            body: JSON.stringify({ event: 'OCCUPANCY_UPDATE', source }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`API socket trigger successful from source: ${source}`);
    } catch (error) {
        console.error(`Failed to trigger socket update (source: ${source}):`, error);
    }
}
