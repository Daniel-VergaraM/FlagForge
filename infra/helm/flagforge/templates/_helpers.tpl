{{/*
Base name of the chart.
*/}}
{{- define "flagforge.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully qualified release name.
*/}}
{{- define "flagforge.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "flagforge.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels.
*/}}
{{- define "flagforge.labels" -}}
helm.sh/chart: {{ include "flagforge.chart" . }}
{{ include "flagforge.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels. Usage: include "flagforge.selectorLabels" (dict "root" . "component" "api")
Falls back to chart-wide selector labels when no component is given.
*/}}
{{- define "flagforge.selectorLabels" -}}
app.kubernetes.io/name: {{ include "flagforge.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "flagforge.componentLabels" -}}
{{ include "flagforge.labels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "flagforge.componentSelectorLabels" -}}
{{ include "flagforge.selectorLabels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Component full name, e.g. "flagforge-api".
*/}}
{{- define "flagforge.componentName" -}}
{{ include "flagforge.fullname" .root }}-{{ .component }}
{{- end -}}

{{/*
Dedicated ServiceAccount name for a component.
*/}}
{{- define "flagforge.serviceAccountName" -}}
{{- if .root.Values.serviceAccount.create -}}
{{ include "flagforge.componentName" . }}
{{- else -}}
default
{{- end -}}
{{- end -}}

{{/*
Resolve an image reference: "<global.imageRegistry>/<repository>:<tag or AppVersion>"
Usage: include "flagforge.image" (dict "root" . "repository" .Values.api.image.repository "tag" .Values.api.image.tag)
*/}}
{{- define "flagforge.image" -}}
{{- $registry := .root.Values.global.imageRegistry -}}
{{- $tag := .tag | default .root.Chart.AppVersion -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry .repository $tag -}}
{{- else -}}
{{- printf "%s:%s" .repository $tag -}}
{{- end -}}
{{- end -}}

{{/*
Get-or-generate-or-persist a random secret value so `helm upgrade` never
rotates credentials that are already live (a Helm-idiomatic pattern using
`lookup` to read back a previous release's Secret before falling back to
random generation).

Usage: include "flagforge.getOrGeneratePassword" (dict "root" $ "explicit" .Values.postgres.auth.password "secretName" $secretName "key" "POSTGRES_PASSWORD" "length" 24)
*/}}
{{/*
Name of the Secret holding Postgres credentials - either the user-supplied
existingSecret (BYO) or the one this chart generates in secrets.yaml.
*/}}
{{- define "flagforge.postgres.secretName" -}}
{{- if .Values.postgres.auth.existingSecret -}}
{{- .Values.postgres.auth.existingSecret -}}
{{- else -}}
{{- printf "%s-postgres" (include "flagforge.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "flagforge.getOrGeneratePassword" -}}
{{- $explicit := .explicit -}}
{{- if $explicit -}}
{{- $explicit -}}
{{- else -}}
{{- $existing := lookup "v1" "Secret" .root.Release.Namespace .secretName -}}
{{- if and $existing (index $existing.data .key) -}}
{{- index $existing.data .key | b64dec -}}
{{- else -}}
{{- randAlphaNum (.length | default 24) -}}
{{- end -}}
{{- end -}}
{{- end -}}
