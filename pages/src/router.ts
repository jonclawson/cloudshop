// Generouted, changes to this file will be overridden
/* eslint-disable */

import { components, hooks, utils } from '@generouted/react-router/client'

export type Path =
  | `/`
  | `/admin/sync-products`
  | `/cart`
  | `/checkout`
  | `/forgot-password`
  | `/login`
  | `/order/:id`
  | `/orders`
  | `/product/:id`
  | `/reset-password`

export type Params = {
  '/order/:id': { id: string }
  '/product/:id': { id: string }
}

export type ModalPath = never

export const { Link, Navigate } = components<Path, Params>()
export const { useModals, useNavigate, useParams } = hooks<Path, Params, ModalPath>()
export const { redirect } = utils<Path, Params>()
