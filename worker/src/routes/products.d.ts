import { Hono } from 'hono';
import { CloudshopEnv } from '../index';
declare const products: Hono<CloudshopEnv, import("hono/types").BlankSchema, "/">;
export default products;
