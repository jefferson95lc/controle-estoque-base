$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$basesDir = Join-Path $repoRoot 'bases'
$sqlFile = Join-Path $PSScriptRoot 'import-bases.sql'

function New-SqlTextLiteral {
  param([string]$Value)

  if ($null -eq $Value -or $Value -eq '') {
    return 'NULL'
  }

  return "'" + ($Value -replace "'", "''") + "'"
}

function New-SqlBoolLiteral {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return 'NULL'
  }

  $normalized = $Value.Trim().ToLowerInvariant()
  if ($normalized -in @('t', 'true', '1', 'y', 'yes')) {
    return 'true'
  }

  return 'false'
}

function New-SqlIntLiteral {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return 'NULL'
  }

  [int]::Parse($Value.Trim()) | Out-Null
  return $Value.Trim()
}

function Add-UpsertStatement {
  param(
    [System.Text.StringBuilder]$Sb,
    [string]$Table,
    [string[]]$Columns,
    [object[]]$Rows,
    [string]$ConflictTarget,
    [string[]]$UpdateAssignments,
    [string]$PrefixComment
  )

  if ($Rows.Count -eq 0) {
    $null = $Sb.AppendLine("-- ${PrefixComment}: sem linhas")
    return
  }

  $null = $Sb.AppendLine("-- $PrefixComment")
  $null = $Sb.Append("INSERT INTO ")
  $null = $Sb.Append($Table)
  $null = $Sb.Append(' (')
  $null = $Sb.Append(($Columns -join ', '))
  $null = $Sb.AppendLine(')')
  $null = $Sb.AppendLine('VALUES')

  for ($i = 0; $i -lt $Rows.Count; $i++) {
    $suffix = if ($i -lt ($Rows.Count - 1)) { ',' } else { '' }
    $null = $Sb.Append('  (')
    $null = $Sb.Append(($Rows[$i] -join ', '))
    $null = $Sb.Append(')')
    $null = $Sb.AppendLine($suffix)
  }

  $null = $Sb.Append('ON CONFLICT (')
  $null = $Sb.Append($ConflictTarget)
  $null = $Sb.AppendLine(') DO UPDATE SET')
  $null = $Sb.Append('  ')
  $null = $Sb.Append(($UpdateAssignments -join ",`n  "))
  $null = $Sb.AppendLine(';')
  $null = $Sb.AppendLine()
}

$sb = [System.Text.StringBuilder]::new()
$null = $sb.AppendLine('BEGIN;')
$null = $sb.AppendLine("SET client_encoding = 'UTF8';")
$null = $sb.AppendLine()

# categories
$categories = Import-Csv -Path (Join-Path $basesDir 'categories.csv')
$categoryRows = @()
foreach ($r in $categories) {
  $categoryRows += ,@(
    (New-SqlTextLiteral $r.id),
    (New-SqlTextLiteral $r.name),
    (New-SqlBoolLiteral $r.active),
    (New-SqlTextLiteral $r.created_at),
    (New-SqlTextLiteral $r.created_at)
  )
}
Add-UpsertStatement -Sb $sb -Table 'public.categories' -Columns @('id', 'name', 'active', 'created_at', 'updated_at') -Rows $categoryRows -ConflictTarget 'id' -UpdateAssignments @('name = EXCLUDED.name', 'active = EXCLUDED.active', 'updated_at = EXCLUDED.updated_at') -PrefixComment 'Carga de categories.csv'

# cost_centers
$costCenters = Import-Csv -Path (Join-Path $basesDir 'cost_centers.csv')
$costCenterRows = @()
foreach ($r in $costCenters) {
  $costCenterRows += ,@(
    (New-SqlTextLiteral $r.id),
    (New-SqlTextLiteral $r.name),
    (New-SqlTextLiteral $r.type),
    (New-SqlTextLiteral $r.created_at),
    (New-SqlTextLiteral $r.created_at)
  )
}
Add-UpsertStatement -Sb $sb -Table 'public.cost_centers' -Columns @('id', 'name', 'type', 'created_at', 'updated_at') -Rows $costCenterRows -ConflictTarget 'id' -UpdateAssignments @('name = EXCLUDED.name', 'type = EXCLUDED.type', 'updated_at = EXCLUDED.updated_at') -PrefixComment 'Carga de cost_centers.csv'

# products
$products = Import-Csv -Path (Join-Path $basesDir 'products.csv')
$productRows = @()
foreach ($r in $products) {
  $productRows += ,@(
    (New-SqlTextLiteral $r.id),
    (New-SqlTextLiteral $r.name),
    (New-SqlTextLiteral $r.sku),
    (New-SqlTextLiteral $r.category),
    (New-SqlTextLiteral $r.unit),
    (New-SqlIntLiteral $r.min_stock),
    (New-SqlTextLiteral $r.created_at),
    (New-SqlTextLiteral $r.updated_at)
  )
}
Add-UpsertStatement -Sb $sb -Table 'public.products' -Columns @('id', 'name', 'sku', 'category', 'unit', 'min_stock', 'created_at', 'updated_at') -Rows $productRows -ConflictTarget 'id' -UpdateAssignments @('name = EXCLUDED.name', 'sku = EXCLUDED.sku', 'category = EXCLUDED.category', 'unit = EXCLUDED.unit', 'min_stock = EXCLUDED.min_stock', 'updated_at = EXCLUDED.updated_at') -PrefixComment 'Carga de products.csv'

# product_min_stock with mapping by names
$productMinStock = Import-Csv -Path (Join-Path $basesDir 'product_min_stock.csv')
if ($productMinStock.Count -gt 0) {
  $null = $sb.AppendLine('-- Carga de product_min_stock.csv (mapeando produto/filial para IDs)')
  $null = $sb.AppendLine('WITH src (id, produto, filial, min_stock, updated_at) AS (')
  $null = $sb.AppendLine('  VALUES')

  for ($i = 0; $i -lt $productMinStock.Count; $i++) {
    $r = $productMinStock[$i]
    $suffix = if ($i -lt ($productMinStock.Count - 1)) { ',' } else { '' }

    $values = @(
      (New-SqlTextLiteral $r.id),
      (New-SqlTextLiteral $r.produto),
      (New-SqlTextLiteral $r.filial),
      (New-SqlIntLiteral $r.min_stock),
      (New-SqlTextLiteral $r.updated_at)
    )
    $line = '    (' + ($values -join ', ') + ')' + $suffix

    $null = $sb.AppendLine($line)
  }

  $null = $sb.AppendLine('), mapped AS (')
  $null = $sb.AppendLine('  SELECT p.id AS product_id, cc.id AS cost_center_id, src.min_stock::integer AS min_stock, src.updated_at::timestamptz AS updated_at,')
  $null = $sb.AppendLine('         row_number() OVER (PARTITION BY p.id, cc.id ORDER BY src.updated_at::timestamptz DESC, src.id DESC) AS rn')
  $null = $sb.AppendLine('  FROM src')
  $null = $sb.AppendLine('  JOIN public.products p ON lower(p.name) = lower(src.produto)')
  $null = $sb.AppendLine('  JOIN public.cost_centers cc ON lower(cc.name) = lower(src.filial)')
  $null = $sb.AppendLine('), dedup AS (')
  $null = $sb.AppendLine('  SELECT product_id, cost_center_id, min_stock, updated_at FROM mapped WHERE rn = 1')
  $null = $sb.AppendLine(')')
  $null = $sb.AppendLine('INSERT INTO public.product_min_stock (product_id, cost_center_id, min_stock, created_at, updated_at)')
  $null = $sb.AppendLine('SELECT product_id, cost_center_id, min_stock, updated_at, updated_at')
  $null = $sb.AppendLine('FROM dedup')
  $null = $sb.AppendLine('ON CONFLICT (product_id, cost_center_id) DO UPDATE SET')
  $null = $sb.AppendLine('  min_stock = EXCLUDED.min_stock,')
  $null = $sb.AppendLine('  updated_at = EXCLUDED.updated_at;')
  $null = $sb.AppendLine()
} else {
  $null = $sb.AppendLine('-- Carga de product_min_stock.csv: sem linhas')
  $null = $sb.AppendLine()
}

# profiles mapped by email to auth.users
$profiles = Import-Csv -Path (Join-Path $basesDir 'profiles.csv')
if ($profiles.Count -gt 0) {
  $null = $sb.AppendLine('-- Carga de profiles.csv (mapeando por email para auth.users)')
  $null = $sb.AppendLine('WITH src (email, active, created_at) AS (')
  $null = $sb.AppendLine('  VALUES')

  for ($i = 0; $i -lt $profiles.Count; $i++) {
    $r = $profiles[$i]
    $suffix = if ($i -lt ($profiles.Count - 1)) { ',' } else { '' }
    $values = @(
      (New-SqlTextLiteral $r.email),
      (New-SqlBoolLiteral $r.active),
      (New-SqlTextLiteral $r.created_at)
    )
    $line = '    (' + ($values -join ', ') + ')' + $suffix

    $null = $sb.AppendLine($line)
  }

  $null = $sb.AppendLine(')')
  $null = $sb.AppendLine('INSERT INTO public.profiles (id, email, active, created_at, updated_at)')
  $null = $sb.AppendLine('SELECT u.id, src.email, src.active::boolean, src.created_at::timestamptz, src.created_at::timestamptz')
  $null = $sb.AppendLine('FROM src')
  $null = $sb.AppendLine('JOIN auth.users u ON lower(u.email) = lower(src.email)')
  $null = $sb.AppendLine('ON CONFLICT (id) DO UPDATE SET')
  $null = $sb.AppendLine('  email = EXCLUDED.email,')
  $null = $sb.AppendLine('  active = EXCLUDED.active,')
  $null = $sb.AppendLine('  updated_at = EXCLUDED.updated_at;')
  $null = $sb.AppendLine()
} else {
  $null = $sb.AppendLine('-- Carga de profiles.csv: sem linhas')
  $null = $sb.AppendLine()
}

# user_roles mapped by email to auth.users
$userRoles = Import-Csv -Path (Join-Path $basesDir 'user_roles.csv')
if ($userRoles.Count -gt 0) {
  $null = $sb.AppendLine('-- Carga de user_roles.csv (mapeando por email para auth.users)')
  $null = $sb.AppendLine('WITH src (id, email, role, created_at) AS (')
  $null = $sb.AppendLine('  VALUES')

  for ($i = 0; $i -lt $userRoles.Count; $i++) {
    $r = $userRoles[$i]
    $suffix = if ($i -lt ($userRoles.Count - 1)) { ',' } else { '' }
    $values = @(
      (New-SqlTextLiteral $r.id),
      (New-SqlTextLiteral $r.email),
      (New-SqlTextLiteral $r.role),
      (New-SqlTextLiteral $r.created_at)
    )
    $line = '    (' + ($values -join ', ') + ')' + $suffix

    $null = $sb.AppendLine($line)
  }

  $null = $sb.AppendLine(')')
  $null = $sb.AppendLine('INSERT INTO public.user_roles (id, user_id, role, created_at)')
  $null = $sb.AppendLine('SELECT src.id::uuid, u.id, src.role::public.app_role, src.created_at::timestamptz')
  $null = $sb.AppendLine('FROM src')
  $null = $sb.AppendLine('JOIN auth.users u ON lower(u.email) = lower(src.email)')
  $null = $sb.AppendLine('ON CONFLICT (user_id, role) DO UPDATE SET')
  $null = $sb.AppendLine('  created_at = EXCLUDED.created_at;')
  $null = $sb.AppendLine()
} else {
  $null = $sb.AppendLine('-- Carga de user_roles.csv: sem linhas')
  $null = $sb.AppendLine()
}

# user_cost_centers mapped by email + filial
$userCostCenters = Import-Csv -Path (Join-Path $basesDir 'user_cost_centers.csv')
if ($userCostCenters.Count -gt 0) {
  $null = $sb.AppendLine('-- Carga de user_cost_centers.csv (mapeando usuario/filial)')
  $null = $sb.AppendLine('WITH src (id, usuario, filial) AS (')
  $null = $sb.AppendLine('  VALUES')

  for ($i = 0; $i -lt $userCostCenters.Count; $i++) {
    $r = $userCostCenters[$i]
    $suffix = if ($i -lt ($userCostCenters.Count - 1)) { ',' } else { '' }
    $values = @(
      (New-SqlTextLiteral $r.id),
      (New-SqlTextLiteral $r.usuario),
      (New-SqlTextLiteral $r.filial)
    )
    $line = '    (' + ($values -join ', ') + ')' + $suffix

    $null = $sb.AppendLine($line)
  }

  $null = $sb.AppendLine(')')
  $null = $sb.AppendLine('INSERT INTO public.user_cost_centers (id, user_id, cost_center_id, created_at)')
  $null = $sb.AppendLine('SELECT src.id::uuid, u.id, cc.id, now()')
  $null = $sb.AppendLine('FROM src')
  $null = $sb.AppendLine('JOIN auth.users u ON lower(u.email) = lower(src.usuario)')
  $null = $sb.AppendLine('JOIN public.cost_centers cc ON lower(cc.name) = lower(src.filial)')
  $null = $sb.AppendLine('ON CONFLICT (user_id, cost_center_id) DO NOTHING;')
  $null = $sb.AppendLine()
} else {
  $null = $sb.AppendLine('-- Carga de user_cost_centers.csv: sem linhas')
  $null = $sb.AppendLine()
}

# stock_movements currently has only header/no rows
$stockMovements = Import-Csv -Path (Join-Path $basesDir 'stock_movements.csv')
if ($stockMovements.Count -eq 0) {
  $null = $sb.AppendLine('-- stock_movements.csv sem linhas para importar')
  $null = $sb.AppendLine()
}

$null = $sb.AppendLine('COMMIT;')

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($sqlFile, $sb.ToString(), $utf8NoBom)
Write-Host "SQL gerado em: $sqlFile"

supabase db query --linked --file $sqlFile --output table
if ($LASTEXITCODE -ne 0) {
  throw 'Falha ao executar a carga SQL no Supabase.'
}

Write-Host ''
Write-Host 'Resumo pós-carga:'
supabase db query "select 'categories' as table_name, count(*) as rows from public.categories union all select 'cost_centers', count(*) from public.cost_centers union all select 'products', count(*) from public.products union all select 'product_min_stock', count(*) from public.product_min_stock union all select 'profiles', count(*) from public.profiles union all select 'user_roles', count(*) from public.user_roles union all select 'user_cost_centers', count(*) from public.user_cost_centers union all select 'stock_movements', count(*) from public.stock_movements order by table_name" --linked --output table
if ($LASTEXITCODE -ne 0) {
  throw 'Falha ao consultar o resumo pós-carga.'
}
