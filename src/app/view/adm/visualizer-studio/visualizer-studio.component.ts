import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { VisualizerCatalogService } from 'src/app/services/visualizer-catalog.service';
import { VisualizerDocument, VisualizerDraft } from 'src/app/services/interfaces/visualizer/visualizer-document';
import { VisualizerConfig, VisualizerStyle } from 'src/app/services/interfaces/visualizer/visualizerconfig';
import { VISUALIZER_PRESETS } from 'src/app/services/visualizer-presets';
import { normalizeVisualizerCustomization } from 'src/app/services/visualizer-customization';

interface StudioControl {
  key: string; label: string; min: number; max: number; step: number; unit?: string;
  styles: VisualizerStyle[];
  group?: 'motion' | 'finish' | 'composition';
}

@Component({
  selector: 'app-visualizer-studio',
  templateUrl: './visualizer-studio.component.html',
  styleUrls: ['./visualizer-studio.component.css']
})
export class VisualizerStudioComponent implements OnInit, OnDestroy {
  readonly templates = [
    { config: VISUALIZER_PRESETS[0], title: 'Ondas de seda', subtitle: 'Fluidas e envolventes', number: '01' },
    { config: VISUALIZER_PRESETS[1], title: 'Pulso elétrico', subtitle: 'O ritmo em cada frequência', number: '02' },
    { config: VISUALIZER_PRESETS[2], title: 'Jardim noturno', subtitle: 'Luzes que dançam devagar', number: '03' }
  ];
  readonly palettes = [
    { name: 'Aurora', colors: ['#a78bfa', '#5eead4'] },
    { name: 'Pôr do sol', colors: ['#fb7185', '#fbbf24'] },
    { name: 'Oceano', colors: ['#38bdf8', '#2dd4bf'] },
    { name: 'Flor de cerejeira', colors: ['#f9a8d4', '#c4b5fd'] }
  ];
  readonly icons = [
    { value: 'show_chart', label: 'Onda' }, { value: 'graphic_eq', label: 'Equalizador' },
    { value: 'flare', label: 'Luz' }, { value: 'waves', label: 'Maré' },
    { value: 'auto_awesome', label: 'Estrelas' }, { value: 'grain', label: 'Partículas' },
    { value: 'bolt', label: 'Energia' }, { value: 'blur_on', label: 'Atmosfera' }
  ];
  readonly colorTokens = [
    { value: 'theme', name: 'Principal do tema' }, { value: 'accent', name: 'Destaque do tema' },
    { value: 'accentLight', name: 'Destaque claro' }, { value: 'secondary', name: 'Secundária do tema' },
    { value: 'text', name: 'Texto do tema' }, { value: 'custom', name: 'Cor personalizada' }
  ];
  readonly controls: StudioControl[] = [
    { key: 'amplitude', label: 'Intensidade', min: 0, max: 100, step: 1, unit: '%', styles: ['silk', 'bars'] },
    { key: 'audioSensitivity', label: 'Resposta ao áudio', min: 0.2, max: 4, step: 0.05, unit: '×', styles: ['silk', 'bars', 'fireflies'] },
    { key: 'speed', label: 'Velocidade', min: 0, max: 5, step: 0.01, unit: '×', styles: ['silk', 'fireflies'] },
    { key: 'frequency', label: 'Frequência das ondas', min: 0.25, max: 12, step: 0.05, styles: ['silk'] },
    { key: 'harmonics', label: 'Harmônicos', min: 1, max: 12, step: 1, styles: ['silk'] },
    { key: 'phase', label: 'Fase', min: -360, max: 360, step: 1, unit: '°', styles: ['silk'] },
    { key: 'layers', label: 'Camadas', min: 1, max: 8, step: 1, styles: ['silk', 'bars'] },
    { key: 'barCount', label: 'Quantidade de barras', min: 12, max: 96, step: 1, styles: ['bars'] },
    { key: 'lineWidth', label: 'Espessura', min: 0.5, max: 10, step: 0.1, unit: 'px', styles: ['silk', 'bars'] },
    { key: 'glow', label: 'Brilho', min: 0, max: 40, step: 1, unit: 'px', styles: ['silk', 'bars'] },
    { key: 'opacity', label: 'Opacidade', min: 0, max: 1, step: 0.01, styles: ['silk', 'bars', 'fireflies'] },
    { key: 'resolution', label: 'Definição da curva', min: 48, max: 768, step: 1, styles: ['silk'] },
    { key: 'scale', label: 'Tamanho do visual', min: 0.25, max: 2, step: 0.05, unit: '×', styles: ['silk', 'bars', 'fireflies'], group: 'composition' },
    { key: 'positionX', label: 'Posição horizontal', min: -50, max: 50, step: 1, unit: '%', styles: ['silk', 'bars', 'fireflies'], group: 'composition' },
    { key: 'positionY', label: 'Posição vertical', min: -50, max: 50, step: 1, unit: '%', styles: ['silk', 'bars', 'fireflies'], group: 'composition' },
    { key: 'angle', label: 'Inclinação', min: -180, max: 180, step: 1, unit: '°', styles: ['silk', 'bars', 'fireflies'], group: 'composition' },
    { key: 'barGap', label: 'Espaço entre barras', min: 0.1, max: 0.9, step: 0.05, styles: ['bars'], group: 'finish' },
    { key: 'particleCount', label: 'Quantidade de luzes', min: 4, max: 96, step: 1, styles: ['fireflies'], group: 'finish' },
    { key: 'particleSize', label: 'Tamanho das luzes', min: 0.5, max: 3, step: 0.1, unit: '×', styles: ['fireflies'], group: 'finish' },
    { key: 'particleSpread', label: 'Dispersão das luzes', min: 0.25, max: 1.5, step: 0.05, unit: '×', styles: ['fireflies'], group: 'composition' },
    { key: 'twinkleSpeed', label: 'Ritmo das piscadas', min: 0.25, max: 3, step: 0.05, unit: '×', styles: ['fireflies'], group: 'motion' },
    { key: 'veilOpacity', label: 'Intensidade das cortinas', min: 0, max: 1, step: 0.05, styles: ['silk'], group: 'finish' }
  ];
  readonly thumbnailBars = Array.from({ length: 28 }, (_, i) => i);
  readonly thumbnailStars = Array.from({ length: 18 }, (_, i) => ({
    x: 12 + ((i * 47) % 280), y: 12 + ((i * 31) % 76), radius: 1 + (i % 3) * 0.5
  }));
  form: FormGroup;
  previewConfig: VisualizerConfig;
  documents: VisualizerDocument[] = [];
  editingId: string | null = null;
  activeTab: 'identity' | 'motion' | 'finish' | 'composition' = 'identity';
  filter: 'all' | 'published' | 'draft' = 'all';
  search = '';
  loading = true;
  saving = false;
  deletingId: string | null = null;
  loadError = '';
  saveError = '';
  notice = '';
  previewPlaying = true;
  previewLight = false;
  online = typeof navigator === 'undefined' || navigator.onLine;
  waitingForServer = false;
  private savingTimer?: ReturnType<typeof setTimeout>;
  private loadSubscription?: Subscription;
  private readonly subscriptions = new Subscription();

  constructor(private fb: FormBuilder, private catalog: VisualizerCatalogService) {
    const config = { ...this.templates[0].config, ...normalizeVisualizerCustomization(this.templates[0].config) };
    const fields: Record<string, unknown> = {};
    Object.entries(config).forEach(([key, value]) => { if (key !== 'id') fields[key] = [value]; });
    fields['name'] = ['', [Validators.required, Validators.maxLength(60), Validators.pattern(/\S/)]];
    fields['description'] = ['', Validators.maxLength(280)];
    fields['enabled'] = [false];
    const colorValidators = [Validators.required, Validators.pattern(/^(theme|accent|secondary|accentLight|text|#[\da-fA-F]{3}(?:[\da-fA-F]{3})?)$/)];
    fields['color'] = ['#a78bfa', colorValidators];
    fields['secondaryColor'] = ['#5eead4', colorValidators];
    fields['icon'] = [config.icon, [Validators.required, Validators.pattern(/^[a-z_]{1,40}$/)]];
    fields['colorMode'] = [config.colorMode, [Validators.required, Validators.pattern(/^(layered|gradient|solid)$/)]];
    fields['waveShape'] = [config.waveShape, [Validators.required, Validators.pattern(/^(sine|triangle|sawtooth)$/)]];
    fields['barLayout'] = [config.barLayout, [Validators.required, Validators.pattern(/^(bottom|center|top)$/)]];
    this.controls.forEach(control => {
      const integer = ['harmonics', 'layers', 'barCount', 'resolution', 'particleCount'].includes(control.key);
      fields[control.key] = [(config as unknown as Record<string, unknown>)[control.key],
        [Validators.required, Validators.min(control.min), Validators.max(control.max),
          ...(integer ? [Validators.pattern(/^\d+$/)] : [])]];
    });
    this.form = this.fb.group(fields);
    this.previewConfig = { ...config, ...this.form.getRawValue(), id: 'studio-preview' };
    this.subscriptions.add(this.form.valueChanges.subscribe(() => {
      this.previewConfig = { ...this.form.getRawValue(), id: this.editingId || 'studio-preview' };
      this.notice = '';
      this.saveError = '';
    }));
  }

  ngOnInit(): void { this.loadLibrary(); }
  ngOnDestroy(): void { this.loadSubscription?.unsubscribe(); this.subscriptions.unsubscribe(); clearTimeout(this.savingTimer); }

  @HostListener('window:online')
  onOnline(): void { this.online = true; }

  @HostListener('window:offline')
  onOffline(): void { this.online = false; }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty || this.saving) { event.preventDefault(); event.returnValue = ''; }
  }

  get publishedCount(): number { return this.documents.filter(item => item.enabled).length; }
  get filteredDocuments(): VisualizerDocument[] {
    const query = this.search.trim().toLocaleLowerCase('pt-BR');
    return this.documents.filter(item =>
      (this.filter === 'all' || item.enabled === (this.filter === 'published')) &&
      (!query || `${item.name} ${item.description}`.toLocaleLowerCase('pt-BR').includes(query)));
  }
  get visibleControls(): StudioControl[] {
    const finish = ['lineWidth', 'glow', 'opacity', 'resolution'];
    return this.controls.filter(control => control.styles.includes(this.previewConfig.visualStyle) &&
      (control.group || (finish.includes(control.key) ? 'finish' : 'motion')) === this.activeTab);
  }

  loadLibrary(): void {
    this.loadSubscription?.unsubscribe();
    this.loading = true;
    this.loadError = '';
    this.loadSubscription = this.catalog.watchAll().subscribe({
      next: documents => { this.documents = documents; this.loading = false; },
      error: () => { this.loading = false; this.loadError = 'Não foi possível carregar a biblioteca. Confira sua conexão e o acesso ao Firebase.'; }
    });
  }

  async confirmDiscard(): Promise<boolean> {
    if (this.saving || this.deletingId) return false;
    if (!this.form.dirty) return true;
    const result = await Swal.fire({
      title: 'Descartar alterações?', text: 'Você tem alterações que ainda não foram salvas.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Descartar', cancelButtonText: 'Continuar editando',
      confirmButtonColor: '#6d28d9'
    });
    return result.isConfirmed;
  }

  async newVisualizer(): Promise<void> {
    if (!await this.confirmDiscard()) return;
    this.editingId = null;
    this.resetForm({ ...this.templates[0].config, name: '', description: '', enabled: false, color: '#a78bfa', secondaryColor: '#5eead4' });
    this.focusEditor();
  }

  applyTemplate(config: VisualizerConfig): void {
    if (this.saving || this.deletingId) return;
    const { id, name, ...parameters } = config;
    this.form.patchValue({ ...parameters, ...normalizeVisualizerCustomization(config) });
    this.form.markAsDirty();
  }

  setIcon(icon: string): void {
    if (this.saving || this.deletingId) return;
    this.form.get('icon')?.setValue(icon);
    this.form.markAsDirty();
  }

  resetComposition(): void {
    if (this.saving || this.deletingId) return;
    const defaults = normalizeVisualizerCustomization({});
    this.form.patchValue({ scale: defaults.scale, positionX: defaults.positionX,
      positionY: defaults.positionY, angle: defaults.angle, mirrorX: defaults.mirrorX,
      particleSpread: defaults.particleSpread });
    this.form.markAsDirty();
  }

  createVariation(): void {
    if (this.saving || this.deletingId) return;
    const pick = <T>(values: T[]): T => values[Math.floor(Math.random() * values.length)];
    const colors = pick(this.palettes).colors;
    const variations: Record<string, unknown> = {
      color: colors[0], secondaryColor: colors[1], opacity: pick([0.55, 0.7, 0.85, 1]),
      audioSensitivity: pick([1, 1.3, 1.6, 2]), scale: pick([0.7, 0.85, 1]),
      angle: pick([-8, 0, 8]), positionX: 0, positionY: 0
    };
    if (this.previewConfig.visualStyle === 'silk') Object.assign(variations, {
      waveShape: pick(['sine', 'triangle', 'sawtooth']), frequency: pick([1.5, 2.5, 4, 6]),
      layers: pick([2, 3, 4, 5]), amplitude: pick([30, 45, 60, 75]),
      speed: pick([0.1, 0.25, 0.4, 0.6]), colorMode: pick(['layered', 'gradient']),
      veilOpacity: pick([0, 0.25, 0.5, 1])
    });
    else if (this.previewConfig.visualStyle === 'bars') Object.assign(variations, {
      barCount: pick([24, 36, 48, 72]), barLayout: pick(['bottom', 'center', 'top']),
      barGap: pick([0.2, 0.35, 0.5, 0.7]), amplitude: pick([45, 60, 75]),
      colorMode: pick(['layered', 'gradient', 'solid'])
    });
    else Object.assign(variations, { particleCount: pick([12, 24, 40, 64]),
      particleSize: pick([0.7, 1, 1.5, 2]), particleSpread: pick([0.5, 0.75, 1]),
      twinkleSpeed: pick([0.5, 0.75, 1, 1.5]), speed: pick([0.08, 0.16, 0.3, 0.5]) });
    this.form.patchValue(variations);
    this.form.markAsDirty();
  }

  applyPalette(colors: string[]): void {
    this.form.patchValue({ color: colors[0], secondaryColor: colors[1] });
    this.form.markAsDirty();
  }

  colorMode(key: string): string {
    const value = this.form.get(key)?.value || '';
    return this.colorTokens.some(token => token.value !== 'custom' && token.value === value) ? value : 'custom';
  }
  setColorMode(key: string, event: Event | string): void {
    const mode = typeof event === 'string' ? event : (event.target as HTMLSelectElement).value;
    this.form.get(key)?.setValue(mode === 'custom' ? (key === 'color' ? '#a78bfa' : '#5eead4') : mode);
    this.form.markAsDirty();
  }
  setColor(key: string, event: Event): void {
    this.form.get(key)?.setValue((event.target as HTMLInputElement).value);
    this.form.markAsDirty();
  }
  colorHex(value: string): string {
    const tokens: Record<string, string> = { theme: '#a78bfa', accent: '#5eead4', secondary: '#818cf8', accentLight: '#ddd6fe', text: '#f1f5f9' };
    if (/^#[\da-f]{6}$/i.test(value)) return value;
    if (/^#[\da-f]{3}$/i.test(value)) return '#' + value.slice(1).split('').map(char => char + char).join('');
    return tokens[value] || '#a78bfa';
  }

  async edit(document: VisualizerDocument): Promise<void> {
    if (!await this.confirmDiscard()) return;
    this.editingId = document.id;
    this.resetForm(document);
    this.focusEditor();
  }

  async duplicate(document: VisualizerDocument): Promise<void> {
    if (!await this.confirmDiscard()) return;
    this.editingId = null;
    this.resetForm({ ...document, name: `${document.name.slice(0, 52)} · cópia`, enabled: false });
    this.form.markAsDirty();
    this.focusEditor();
  }

  async save(): Promise<void> {
    if (this.saving || this.deletingId) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) { this.saveError = 'Revise o nome e os valores destacados antes de salvar.'; return; }
    this.saving = true;
    this.waitingForServer = false;
    this.savingTimer = setTimeout(() => { this.waitingForServer = true; }, 10000);
    this.saveError = '';
    this.notice = '';
    const draft = this.form.getRawValue() as VisualizerDraft;
    draft.name = draft.name.trim();
    draft.description = draft.description.trim();
    this.form.disable({ emitEvent: false });
    try {
      if (this.editingId) await this.catalog.update(this.editingId, draft);
      else this.editingId = await this.catalog.create(draft);
      this.form.patchValue({ name: draft.name, description: draft.description }, { emitEvent: false });
      this.form.markAsPristine();
      this.notice = draft.enabled ? 'Visualizer salvo e publicado no player.' : 'Rascunho salvo na sua biblioteca.';
    } catch {
      this.saveError = 'Não foi possível salvar. Suas alterações continuam aqui. Confira sua conexão e tente novamente.';
    } finally {
      clearTimeout(this.savingTimer);
      this.waitingForServer = false;
      this.saving = false;
      this.form.enable({ emitEvent: false });
    }
  }

  async remove(document: VisualizerDocument): Promise<void> {
    if (this.saving || this.deletingId) return;
    const result = await Swal.fire({
      title: 'Excluir visualizer?', text: `“${document.name}” será removido da biblioteca e do player.`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#be123c'
    });
    if (!result.isConfirmed) return;
    this.deletingId = document.id;
    this.saveError = '';
    try {
      await this.catalog.delete(document.id);
      if (this.editingId === document.id) {
        this.editingId = null;
        this.resetForm({ ...this.templates[0].config, name: '', description: '', enabled: false });
      }
      this.notice = 'Visualizer excluído.';
    } catch { this.saveError = 'Não foi possível excluir o visualizer. Tente novamente.'; }
    finally { this.deletingId = null; }
  }

  styleName(style: VisualizerStyle): string {
    return { silk: 'Ondas', bars: 'Equalizador', fireflies: 'Vaga-lumes' }[style];
  }
  barHeight(index: number, config: VisualizerConfig): number {
    return 6 + Math.abs(Math.sin(index * 0.74 + config.phase) * Math.cos(index * 0.19)) * (18 + config.amplitude * 0.45);
  }
  wavePath(config: VisualizerConfig, layer: number): string {
    return Array.from({ length: 90 }, (_, i) => {
      const x = i / 89;
      const y = 50 + Math.sin(x * config.frequency * Math.PI * 2 + layer * 0.55) * Math.sin(x * Math.PI) * config.amplitude * 0.35;
      return `${i ? 'L' : 'M'}${(x * 308).toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
  trackById(_: number, item: VisualizerDocument): string { return item.id; }

  private resetForm(config: VisualizerConfig & { description?: string; enabled?: boolean }): void {
    this.form.reset({ ...config, ...normalizeVisualizerCustomization(config), description: config.description || '', enabled: config.enabled ?? false });
    this.activeTab = 'identity';
    this.saveError = '';
    this.notice = '';
    this.previewPlaying = true;
  }
  private focusEditor(): void {
    document.getElementById('visualizer-studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('visualizer-name')?.focus({ preventScroll: true });
  }
}
