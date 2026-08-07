export interface PageDef {
  key: string;
  label: string;
}

export interface RolePermission {
  role: 'ADMIN' | 'SALES' | 'MACHINE_OPERATOR' | 'PACKING_OPERATOR';
  pages: string[];
}