import { CreateFolhaInput, UpdateFolhaInput } from '../schemas/folha.schema.ts';

export interface Folha {
  id: string;
  nome: string;
  cor: string;
  profissao: string;
  assinatura: string;
  mensagem: string;
  edit_token: string;
  edit_expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface IFolhaRepository {
  create(data: CreateFolhaInput): Promise<Folha>;
  findForTelao(limit?: number): Promise<Folha[]>;
  findById(id: string): Promise<Folha | null>;
  findByEditToken(token: string): Promise<Folha | null>;
  updateByEditToken(token: string, data: UpdateFolhaInput): Promise<Folha | null>;
  deleteById(id: string): Promise<boolean>;
  count(): Promise<number>;
  findAll(): Promise<Folha[]>;
  resetAll(): Promise<void>;
  importMany(folhas: Folha[]): Promise<number>;
}
