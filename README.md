# Manutencao de Extintores

Aplicacao profissional PWA para manutencao de extintores de incendio. Funciona offline, instalavel no Android, dados 100% locais.

## Caracteristicas

- **PWA** — Instalavel no Android como aplicacao
- **Offline** — Funciona sem internet apos primeira carga
- **Dados locais** — Tudo armazenado no dispositivo (IndexedDB)
- **Mobile-first** — Design otimizado para telemovel
- **Rapido** — Poucos toques para registar cada extintor

## Funcionalidades

| Area | Descricao |
|------|-----------|
| **Cadastro** | Formulario rapido de extintores com numeracao automatica |
| **Clientes** | Criar cliente com nome, morada e telefone ao iniciar servico |
| **Servicos** | Criar, consultar e finalizar servicos |
| **Pesquisa** | Filtros avancados e estatisticas dinamicas |
| **Historico** | Consulta de todos os servicos anteriores |
| **PDF** | Relatorio profissional para impressao |
| **TXT** | Exportacao em texto simples |
| **WhatsApp** | Partilha direta de relatorios |
| **Backup** | Exportar/importar todos os dados |

## Como colocar no GitHub

1. Criar um novo repositorio no GitHub
2. Copiar todos os ficheiros para o repositorio
3. Fazer commit e push

```bash
git init
git add .
git commit -m "Manutencao de Extintores v1.0"
git remote add origin https://github.com/SEU_USER/manutencao-extintor.git
git push -u origin main
```

## Como ativar GitHub Pages

1. Ir a **Settings** > **Pages** no repositorio
2. Em **Source**, selecionar **Deploy from a branch**
3. Selecionar **main** e a pasta **/ (root)**
4. Clicar **Save**
5. A aplicacao fica disponivel em: `https://SEU_USER.github.io/manutencao-extintor/`

## Como instalar no Android

1. Abrir a aplicacao no Chrome do Android
2. Tocar nos **3 pontos** (menu)
3. Selecionar **Adicionar ao ecra inicial**
4. Confirmar

A aplicacao funciona como um app nativo, com icone proprio e ecra sem barra do navegador.

## Como funciona o modo offline

A aplicacao utiliza um **Service Worker** que cacheia todos os ficheiros necessarios. Apos a primeira carga, todos os dados ficam armazenados no dispositivo:

- **Service Worker** — Cache de todos os ficheiros da aplicacao
- **IndexedDB** — Armazenamento de clientes, servicos e extintores
- **manifest.json** — Configuracao para instalacao como PWA

## Como fazer backup

1. Ir a **Mais** > **Backup**
2. Tocar em **Exportar Backup**
3. Guardar o ficheiro JSON gerado

O backup contem todos os clientes, servicos, extintores e configuracoes.

## Como restaurar backup

1. Ir a **Mais** > **Backup**
2. Tocar em **Importar Backup**
3. Selecionar o ficheiro JSON de backup
4. Confirmar a substituicao

**Atencao:** Isto substitui TODOS os dados atuais do dispositivo.

## Estrutura de ficheiros

```
├── index.html          # Pagina principal
├── style.css           # Estilos CSS (mobile-first)
├── app.js              # Logica da aplicacao
├── db.js               # Camada IndexedDB
├── manifest.json       # Configuracao PWA
├── service-worker.js   # Cache offline
├── icons/
│   ├── icon-192.png    # Icone 192x192
│   ├── icon-512.png    # Icone 512x512
│   └── icon.svg        # Icone SVG
├── generate-icons.html # Gerador de icones (abrir no browser)
└── README.md           # Este ficheiro
```

## Gerar icones

### Opcao 1 — Browser (recomendado)
1. Abrir `generate-icons.html` no browser
2. Tocar nos botoes para gerar e descarregar cada icone
3. Mover os PNGs para a pasta `icons/`

### Opcao 2 — Node.js
```bash
npm install canvas
node generate-icons.js
```

## Tecnologias

- HTML5
- CSS3 (variaveis CSS, grid, flexbox)
- JavaScript puro (sem dependencias)
- IndexedDB (armazenamento local)
- Service Worker (cache offline)
- manifest.json (PWA)
