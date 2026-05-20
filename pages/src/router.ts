// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `/`
  | `/admin/orders`
  | `/admin/orders/:id`
  | `/admin/products`
  | `/admin/sync-products`
  | `/admin/users`
  | `/admin/users/:id`
  | `/cart`
  | `/checkout`
  | `/forgot-password`
  | `/login`
  | `/order/:id`
  | `/orders`
  | `/product/:id`
  | `/reset-password`

export type Params = {
  '/admin/orders/:id': { id: string }
  '/admin/users/:id': { id: string }
  '/order/:id': { id: string }
  '/product/:id': { id: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
