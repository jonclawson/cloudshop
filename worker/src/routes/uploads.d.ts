import { Hono } from 'hono';
import { CloudshopEnv } from '../index';
declare const uploads: Hono<CloudshopEnv, import("hono/types").BlankSchema, "/">;
export default uploads;
