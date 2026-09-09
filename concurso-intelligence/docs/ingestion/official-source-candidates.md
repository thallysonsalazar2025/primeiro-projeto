# Fontes oficiais candidatas para a primeira carga externa

Este documento evita habilitar no registry uma URL que ainda não entrega o schema JSON esperado pelo pipeline. A regra permanece fail-closed: uma fonte só entra em `config/ingestion-sources*.json` com `enabled: true` depois de validar formato, proveniência, base de uso e adaptação para o contrato de importação.

## Critérios de prontidão

Uma fonte está pronta para ingestão quando:

1. a origem é oficial ou possui licença/termos compatíveis com reúso;
2. a URL é pública e estável o suficiente para auditoria;
3. o formato é conhecido e o adaptador correspondente existe;
4. o payload normalizado preserva concurso, banca, cargo/prova, ano, origem e gabarito quando aplicável;
5. A4 valida fingerprint/deduplicação e persistência;
6. A9 cobre regressão e preservação do Simulado DATAPREV legado;
7. A10 valida URL, redirects, tamanho, integridade e política SSRF.

## Candidatas verificadas

| Prioridade | Fonte oficial | Conteúdo | Formato observado | Situação no pipeline |
| --- | --- | --- | --- | --- |
| P1 | Ministério da Gestão e da Inovação - CNU: `https://www.gov.br/gestao/pt-br/concursonacional/caderno-de-provas-e-gabaritos` | Cadernos de prova e gabaritos oficiais | PDF | **Bloqueada por adaptador PDF**. Não cadastrar como fonte JSON habilitada. |
| P1 | BNDES - Seleção Pública 2024: `https://www.bndes.gov.br/wps/portal/site/home/quem-somos/trabalhar-no-bndes/concursos-selecao-publica-2024` | Provas e gabaritos, incluindo Análise de Sistemas | PDF | **Bloqueada por adaptador PDF**. Boa candidata de TI para validar o primeiro fluxo real. |
| P2 | Dados Abertos Goiás - Concursos e Processos Seletivos: `https://dadosabertos.go.gov.br/dataset/concurso-e-selecao` | Dados administrativos de concursos/processos seletivos | CSV/ZIP | **Bloqueada por adaptador tabular** e por mapeamento de domínio; não representa banco de questões por si só. |

## Decisão de implementação

O próximo incremento de A7 deve ser um adaptador de documento oficial separado do runner JSON já existente. O runner atual continuará responsável apenas por payloads normalizados em `questions` ou `rankings`.

Ordem recomendada:

1. criar contrato de `OfficialDocumentCandidate` com `sourceUrl`, `documentUrl`, `documentType`, `usageBasis`, `retrievedAt` e `sha256`;
2. implementar download seguro reutilizando o gate HTTP/SSRF e limites já existentes;
3. armazenar o documento bruto e manifesto de proveniência fora das filas `questions`/`rankings`;
4. adicionar adaptador PDF específico para prova/gabarito;
5. somente depois da normalização, publicar o JSON validado na fila existente;
6. executar primeira carga em uma prova oficial pequena e auditar o resultado antes de ampliar a cobertura.

## Não fazer

- Não marcar uma fonte PDF/CSV como `enabled: true` no registry JSON atual.
- Não copiar bancos de questões de terceiros sem base de uso verificável.
- Não remover, reescrever ou migrar destrutivamente o dataset DATAPREV legado.
- Não contabilizar este mapeamento como primeira carga concluída; a issue A7 só avança nessa entrega quando houver código revisado e mergeado, e a primeira carga externa só deve ser considerada concluída após importação efetiva e validada.
