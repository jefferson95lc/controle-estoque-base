# Pedido
- [x] Adicionar exclusão individual de pedidos com confirmação restrita ao Master e fornecer SQL de permissão para produção externa.
- [ ] Ativar permissão de exclusão Master na produção externa — depende da execução do SQL adicional fornecido.
- [x] Incluir salvamento de pedidos completos, consulta por filial e reexportação XLS/PDF em histórico compartilhado.
- [ ] Ativar histórico na produção externa e verificar com sessão real — depende da execução do SQL fornecido no banco externo.
- [x] Ajustar média semanal por semanas inteiras do período (parcial conta como uma) e mostrar semanas abaixo das datas.
- [x] Adicionar menu e tela isolada com período, semanas, consumo e estoque atual.
- [x] Permitir edição, inclusão, remoção e validação individual dos itens.
- [x] Gerar pedido final e exportar XLS/PDF; cálculos, seleção e arquivos verificados em testes; PDF de três páginas inspecionado sem cortes ou sobreposição.
- [ ] Conferir o fluxo completo e os downloads com sessão real de produção — bloqueado pela ausência de sessão autenticada disponível para o banco externo usado pelo app.