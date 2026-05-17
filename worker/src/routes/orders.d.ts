import { Hono } from 'hono';
import { CloudshopEnv } from '../index';
declare const orders: Hono<CloudshopEnv, import("hono/types").BlankSchema, "/">;
export default orders;
