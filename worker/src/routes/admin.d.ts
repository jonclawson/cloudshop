import { Hono } from 'hono';
import { CloudshopEnv } from '../index';
declare const admin: Hono<CloudshopEnv, import("hono/types").BlankSchema, "/">;
export default admin;
