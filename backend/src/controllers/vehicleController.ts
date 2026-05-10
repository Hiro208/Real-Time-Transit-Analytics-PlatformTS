import { Request, Response } from 'express';
import { VehicleRepository } from '../repositories/vehicleRepository';
import fs from 'fs';
import path from 'path';

type StopRecord = { lat: number; lon: number; name?: string };
let stopsCache: Record<string, StopRecord> | null = null;

function loadStopsMap(): Record<string, StopRecord> {
  if (!stopsCache) {
    const stopsPath = path.join(__dirname, '../data/stops.json');
    if (!fs.existsSync(stopsPath)) {
      stopsCache = {};
    } else {
      try {
        stopsCache = JSON.parse(fs.readFileSync(stopsPath, 'utf-8'));
      } catch {
        stopsCache = {};
      }
    }
  }
  return stopsCache || {};
}

export class VehicleController {
  /**
   * GET /api/vehicles
   * 获取所有活跃车辆
   */
  static async getAllVehicles(req: Request, res: Response) {
    try {
      const vehicles = await VehicleRepository.findAll();
      res.json({
        success: true,
        count: vehicles.length,
        data: vehicles
      });
    } catch (error) {
      res.status(500).json({ success: false, message: '获取数据失败' });
    }
  }

  /**
   * GET /api/vehicles/insights
   * 返回时间窗趋势与对比指标
   */
  static async getVehicleInsights(req: Request, res: Response) {
    try {
      const route = typeof req.query.route === 'string' ? req.query.route : 'ALL';
      const range = typeof req.query.range === 'string' ? req.query.range : '1h';
      const compare = typeof req.query.compare === 'string' ? req.query.compare : 'previous';

      const insights = await VehicleRepository.getInsights({ route, range, compare });
      res.json({
        success: true,
        data: insights,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: '获取趋势数据失败' });
    }
  }

  /**
   * GET /api/vehicles/stops/:stopId
   * 返回站点静态坐标
   */
  static async getStopCoords(req: Request, res: Response) {
    try {
      const stopId = String(req.params.stopId || '').trim().toUpperCase();
      if (!stopId) return res.status(400).json({ success: false, message: 'stopId is required' });
      const stops = loadStopsMap();
      const hit = stops[stopId] || stops[stopId.replace(/[NS]$/, '')];
      if (!hit) return res.status(404).json({ success: false, message: 'stop not found' });
      return res.json({
        success: true,
        data: {
          stop_id: stopId,
          stop_name: hit.name || stopId,
          lat: hit.lat,
          lon: hit.lon,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: '获取站点坐标失败' });
    }
  }
}