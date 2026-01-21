import { usePlateStore } from '../store/plateStore';
import { useAlarmStore } from '../store/alarmStore';
import { Plate, PlateType } from '../types/plate';

class SimulationService {
    private intervalId: number | null = null;
    private trendIntervalId: number | null = null;

    start() {
        if (this.intervalId) return;

        console.log('Starting simulation mode...');
        
        // Simulate new plates every 3-8 seconds
        this.intervalId = window.setInterval(() => {
            this.generateRandomPlate();
        }, 3000);

        // Simulate trend updates every 10 seconds
        this.trendIntervalId = window.setInterval(() => {
            this.updateTrends();
        }, 10000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.trendIntervalId) {
            clearInterval(this.trendIntervalId);
            this.trendIntervalId = null;
        }
        console.log('Simulation mode stopped.');
    }

    private generateRandomPlate() {
        const { addPlate, settings } = usePlateStore.getState();
        
        // 10% chance to skip (simulate quiet time)
        if (Math.random() > 0.9) return;

        const isGreen = Math.random() > 0.7;
        const plateNumber = this.generatePlateNumber(isGreen);
        
        const plate: Plate = {
            id: Math.random().toString(36).substr(2, 9),
            number: plateNumber,
            type: isGreen ? 'green' : this.getWeightedType(),
            confidence: 0.85 + Math.random() * 0.14,
            timestamp: Date.now(),
            location: `摄像头 ${Math.floor(Math.random() * 4) + 1} - ${Math.random() > 0.5 ? '入口' : '出口'}`,
            saved: true,
            rect: { x: 100, y: 100, w: 200, h: 100 } // Mock rect
        };

        addPlate(plate);
        
        // 5% chance to trigger alarm (blacklist)
        if (Math.random() < 0.05) {
            this.triggerAlarm(plate);
        }
    }

    private generatePlateNumber(isGreen: boolean): string {
        const provinces = ['京', '沪', '粤', '苏', '浙', '湘', '鄂', '川', '渝'];
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const nums = '0123456789';

        const province = provinces[Math.floor(Math.random() * provinces.length)];
        const city = chars[Math.floor(Math.random() * chars.length)];
        
        let number = '';
        const length = isGreen ? 6 : 5;

        for (let i = 0; i < length; i++) {
            number += nums[Math.floor(Math.random() * nums.length)];
        }

        return `${province}${city}·${number}`;
    }

    private getWeightedType(): PlateType {
        const rand = Math.random();
        if (rand < 0.7) return 'blue';
        if (rand < 0.9) return 'yellow'; // Trucks/Buses
        if (rand < 0.95) return 'white'; // Police/Military
        return 'black'; // Diplomatic/Foreign
    }

    private triggerAlarm(plate: Plate) {
        const { addAlarm } = useAlarmStore.getState();
        
        const alarm = {
            id: Date.now(),
            plate_id: Math.floor(Math.random() * 10000),
            blacklist_id: Math.floor(Math.random() * 100),
            timestamp: Date.now(),
            is_read: 0,
            plate_number: plate.number,
            location: plate.location,
            reason: '模拟黑名单报警',
            severity: 'high' as const
        };

        addAlarm(alarm);
        console.warn(`[SIMULATION] Alarm triggered for ${plate.number}`);
    }

    private updateTrends() {
        // In a real app, this would recalculate based on history.
        // Here we just let the store's derived stats handle the counts.
        // The "trends" (up/down percentages) are currently static in the store or fetched via API.
        // We could update them here if the store supported setting trends explicitly.
    }
}

export const simulationService = new SimulationService();
