import { Router } from 'express';
import { VehicleController } from '../controllers/vehicleController';

const router = Router();

router.get('/stops/:stopId', VehicleController.getStopCoords);
router.get('/insights', VehicleController.getVehicleInsights);
router.get('/', VehicleController.getAllVehicles);

export default router;