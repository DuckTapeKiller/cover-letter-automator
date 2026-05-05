import { App, PluginSettingTab, Setting, setIcon, TFolder, TFile, AbstractInputSuggest } from 'obsidian';
import type CoverLetterPlugin from './main';
import { PROVIDER_MODELS } from './main';

export type AiProvider = 'ollama' | 'claude' | 'gemini' | 'openai';

export interface CoverLetterSettings {
    // Folders
    outputFolder: string;
    // Identity
    senderName: string;
    senderPhone: string;
    senderEmail: string;
    fromEmail: string;
    candidateProfile: string;
    candidateSkills: string;
    candidateEducation: string;
    candidateExperience: string;
    // Fields
    professionalFields: string[];
    defaultField: string;
    // Design (backgroundColor removed — always white)
    marginSize: number;
    fontName: string;
    // AI Provider
    aiProvider: AiProvider;
    // Ollama
    ollamaUrl: string;
    modelName: string;
    // Claude API
    claudeApiKey: string;
    claudeModel: string;
    // Gemini API
    geminiApiKey: string;
    geminiModel: string;
    // OpenAI API
    openaiApiKey: string;
    openaiModel: string;
    // Email
    cvPaths: { name: string, path: string }[];
    // Language
    language: string;
}

export const DEFAULT_SETTINGS: CoverLetterSettings = {
    outputFolder: 'Cover Letters',
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    fromEmail: '',
    candidateProfile: '',
    candidateSkills: '',
    candidateEducation: '',
    candidateExperience: '',
    professionalFields: ['Software Engineering', 'Product Management', 'Data Science'],
    defaultField: 'Software Engineering',
    marginSize: 1440,
    fontName: 'Lora',
    aiProvider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    modelName: 'llama3',
    claudeApiKey: '',
    claudeModel: 'claude-3-5-haiku-latest',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    cvPaths: [],
    language: 'en-GB',
};

export class CoverLetterSettingTab extends PluginSettingTab {
    plugin: CoverLetterPlugin;

    constructor(app: App, plugin: CoverLetterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Cover Letter Automator' });

        // ── SENDER IDENTITY ──────────────────────────────────────────────
        const identitySection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        identitySection.open = true;
        const identitySummary = identitySection.createEl('summary');
        setIcon(identitySummary, 'user');
        identitySummary.createSpan({ text: ' Sender Identity' });

        new Setting(identitySection)
            .setName('Full Name')
            .addText(t => t.setPlaceholder('DuckTapeKiller')
                .setValue(this.plugin.settings.senderName)
                .onChange(async v => { this.plugin.settings.senderName = v; await this.plugin.saveSettings(); }));

        new Setting(identitySection)
            .setName('Phone')
            .addText(t => t.setPlaceholder('+44 7700 000000')
                .setValue(this.plugin.settings.senderPhone)
                .onChange(async v => { this.plugin.settings.senderPhone = v; await this.plugin.saveSettings(); }));

        new Setting(identitySection)
            .setName('Email')
            .addText(t => t.setPlaceholder('you@email.com')
                .setValue(this.plugin.settings.senderEmail)
                .onChange(async v => { this.plugin.settings.senderEmail = v; await this.plugin.saveSettings(); }));

        new Setting(identitySection)
            .setName('From Email')
            .addText(t => t.setPlaceholder('sender@domain.com')
                .setValue(this.plugin.settings.fromEmail)
                .onChange(async v => { this.plugin.settings.fromEmail = v; await this.plugin.saveSettings(); }));

        new Setting(identitySection)
            .setName('Professional Fields')
            .setDesc('Comma-separated list of fields shown in the generation modal.')
            .addTextArea(t => t
                .setValue(this.plugin.settings.professionalFields.join(', '))
                .onChange(async v => {
                    this.plugin.settings.professionalFields = v.split(',').map(s => s.trim()).filter(Boolean);
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to update Default Field dropdown
                }));

        new Setting(identitySection)
            .setName('Default Field')
            .setDesc('This field will be pre-selected in the generation modal.')
            .addDropdown(dd => {
                this.plugin.settings.professionalFields.forEach(f => dd.addOption(f, f));
                dd.setValue(this.plugin.settings.defaultField);
                dd.onChange(async v => {
                    this.plugin.settings.defaultField = v;
                    await this.plugin.saveSettings();
                });
            });

        // ── CANDIDATE PROFILE ──────────────────────────────────────────────
        const profileSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        profileSection.open = true;
        const profileSummary = profileSection.createEl('summary');
        setIcon(profileSummary, 'book-open');
        profileSummary.createSpan({ text: ' Candidate Profile' });

        new Setting(profileSection)
            .setName('Professional Summary')
            .addTextArea(t => {
                t.inputEl.rows = 4;
                t.setValue(this.plugin.settings.candidateProfile).onChange(async v => { this.plugin.settings.candidateProfile = v; await this.plugin.saveSettings(); });
            });

        new Setting(profileSection)
            .setName('Skills')
            .addTextArea(t => {
                t.inputEl.rows = 4;
                t.setValue(this.plugin.settings.candidateSkills).onChange(async v => { this.plugin.settings.candidateSkills = v; await this.plugin.saveSettings(); });
            });

        new Setting(profileSection)
            .setName('Education')
            .addTextArea(t => {
                t.inputEl.rows = 6;
                t.setValue(this.plugin.settings.candidateEducation).onChange(async v => { this.plugin.settings.candidateEducation = v; await this.plugin.saveSettings(); });
            });

        new Setting(profileSection)
            .setName('Experience')
            .addTextArea(t => {
                t.inputEl.rows = 10;
                t.setValue(this.plugin.settings.candidateExperience).onChange(async v => { this.plugin.settings.candidateExperience = v; await this.plugin.saveSettings(); });
            });

        // ── AI PROVIDER ──────────────────────────────────────────────────
        const aiSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        aiSection.open = true;
        aiSection.createEl('summary', { text: '◈ AI Providers' });

        new Setting(aiSection)
            .setName('Active Provider')
            .setDesc('Choose which AI service generates the cover letter body.')
            .addDropdown(dd => {
                dd.addOption('ollama', 'Ollama (local)');
                dd.addOption('claude', 'Anthropic Claude (API)');
                dd.addOption('gemini', 'Google Gemini (API)');
                dd.addOption('openai', 'OpenAI GPT (API)');
                dd.setValue(this.plugin.settings.aiProvider);
                dd.onChange(async v => {
                    this.plugin.settings.aiProvider = v as AiProvider;
                    await this.plugin.saveSettings();
                    this.display(); // re-render to show/hide sub-settings
                });
            });

        if (this.plugin.settings.aiProvider === 'ollama') {
            new Setting(aiSection)
                .setName('Ollama URL')
                .addText(t => t.setPlaceholder('http://localhost:11434')
                    .setValue(this.plugin.settings.ollamaUrl)
                    .onChange(async v => { this.plugin.settings.ollamaUrl = v; await this.plugin.saveSettings(); }));

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Select or type your local model.')
                .addDropdown(dd => {
                    const common = ['llama3', 'mistral', 'phi3', 'gemma'];
                    common.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.modelName;
                    dd.setValue(common.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') {
                            this.plugin.settings.modelName = v;
                            await this.plugin.saveSettings();
                        }
                        this.display();
                    });
                });

            if (!['llama3', 'mistral', 'phi3', 'gemma'].includes(this.plugin.settings.modelName)) {
                new Setting(aiSection)
                    .setName('Custom Ollama Model')
                    .addText(t => t
                        .setPlaceholder('llama3:8b')
                        .setValue(this.plugin.settings.modelName === 'custom' ? '' : this.plugin.settings.modelName)
                        .onChange(async v => {
                            this.plugin.settings.modelName = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        if (this.plugin.settings.aiProvider === 'claude') {
            new Setting(aiSection)
                .setName('Anthropic API Key')
                .setDesc('Stored only in your local vault data.')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('sk-ant-...')
                        .setValue(this.plugin.settings.claudeApiKey)
                        .onChange(async v => { this.plugin.settings.claudeApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your Claude model.')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.claude;
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.claudeModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.claudeModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.claude.includes(this.plugin.settings.claudeModel)) {
                new Setting(aiSection)
                    .setName('Custom Claude Model')
                    .addText(t => t
                        .setPlaceholder('claude-2.1')
                        .setValue(this.plugin.settings.claudeModel === 'custom' ? '' : this.plugin.settings.claudeModel)
                        .onChange(async v => {
                            this.plugin.settings.claudeModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        if (this.plugin.settings.aiProvider === 'gemini') {
            new Setting(aiSection)
                .setName('Google API Key')
                .setDesc('Stored only in your local vault data.')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('AIza...')
                        .setValue(this.plugin.settings.geminiApiKey)
                        .onChange(async v => { this.plugin.settings.geminiApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your Gemini model.')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.gemini;
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.geminiModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.geminiModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.gemini.includes(this.plugin.settings.geminiModel)) {
                new Setting(aiSection)
                    .setName('Custom Gemini Model')
                    .addText(t => t
                        .setPlaceholder('gemini-2.5-flash')
                        .setValue(this.plugin.settings.geminiModel === 'custom' ? '' : this.plugin.settings.geminiModel)
                        .onChange(async v => {
                            this.plugin.settings.geminiModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        if (this.plugin.settings.aiProvider === 'openai') {
            new Setting(aiSection)
                .setName('OpenAI API Key')
                .setDesc('Stored only in your local vault data.')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('sk-...')
                        .setValue(this.plugin.settings.openaiApiKey)
                        .onChange(async v => { this.plugin.settings.openaiApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your GPT model.')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.openai;
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.openaiModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.openaiModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.openai.includes(this.plugin.settings.openaiModel)) {
                new Setting(aiSection)
                    .setName('Custom GPT Model')
                    .addText(t => t
                        .setPlaceholder('gpt-4')
                        .setValue(this.plugin.settings.openaiModel === 'custom' ? '' : this.plugin.settings.openaiModel)
                        .onChange(async v => {
                            this.plugin.settings.openaiModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        // ── DESIGN & FOLDERS ─────────────────────────────────────────────
        const designSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        designSection.open = true;
        const designSummary = designSection.createEl('summary');
        setIcon(designSummary, 'palette');
        designSummary.createSpan({ text: ' Design & Folders' });

        new Setting(designSection)
            .setName('Font Family')
            .setDesc('Must be installed on your system (PDF) or available to docx viewers.')
            .addText(t => t.setPlaceholder('Lora')
                .setValue(this.plugin.settings.fontName)
                .onChange(async v => { this.plugin.settings.fontName = v; await this.plugin.saveSettings(); }));

        new Setting(designSection)
            .setName('Page Margin (twips)')
            .setDesc('1440 twips = 1 inch. Range: 720 (½ in) – 2880 (2 in).')
            .addSlider(s => s.setLimits(720, 2880, 120)
                .setValue(this.plugin.settings.marginSize)
                .setDynamicTooltip()
                .onChange(async v => { this.plugin.settings.marginSize = v; await this.plugin.saveSettings(); }));

        new Setting(designSection)
            .setName('Output Folder')
            .setDesc('Vault path where generated files are saved.')
            .addText(t => {
                new FolderSuggest(this.app, t.inputEl);
                t.setPlaceholder('Cover Letters')
                    .setValue(this.plugin.settings.outputFolder)
                    .onChange(async v => { this.plugin.settings.outputFolder = v; await this.plugin.saveSettings(); });
            });

        // ── CV LIBRARY ──────────────────────────────────────────────────
        const cvSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        cvSection.open = true;
        const cvSummary = cvSection.createEl('summary');
        setIcon(cvSummary, 'folder-heart');
        cvSummary.createSpan({ text: ' CV Library' });

        new Setting(cvSection)
            .setName('Add CV to Library')
            .setDesc('Add a new CV version to your collection.')
            .addButton(btn => btn
                .setButtonText('+ Add CV')
                .onClick(async () => {
                    this.plugin.settings.cvPaths.push({ name: 'New CV', path: '' });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        this.plugin.settings.cvPaths.forEach((cv, i) => {
            const s = new Setting(cvSection)
                .addText(t => t
                    .setPlaceholder('Label (e.g. Developer CV)')
                    .setValue(cv.name)
                    .onChange(async v => {
                        this.plugin.settings.cvPaths[i].name = v;
                        await this.plugin.saveSettings();
                    }))
                .addText(t => {
                    new FileSuggest(this.app, t.inputEl);
                    t.setPlaceholder('Path/to/CV.pdf')
                        .setValue(cv.path)
                        .onChange(async v => {
                            this.plugin.settings.cvPaths[i].path = v;
                            await this.plugin.saveSettings();
                        });
                })
                .addExtraButton(eb => eb
                    .setIcon('trash')
                    .setTooltip('Remove CV')
                    .onClick(async () => {
                        this.plugin.settings.cvPaths.splice(i, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
            s.infoEl.remove(); // Keep it compact
        });

        // ── LANGUAGE ─────────────────────────────────────────────────────
        const langSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        langSection.open = true;
        const langSummary = langSection.createEl('summary');
        setIcon(langSummary, 'languages');
        langSummary.createSpan({ text: ' Language' });

        new Setting(langSection)
            .setName('Output Language')
            .setDesc('The language the AI will use to write the cover letter and email.')
            .addDropdown(dd => {
                dd.addOption('en-GB', 'British English');
                dd.addOption('es', 'Spanish');
                dd.addOption('en-US', 'American English');
                dd.setValue(this.plugin.settings.language);
                dd.onChange(async v => {
                    this.plugin.settings.language = v;
                    await this.plugin.saveSettings();
                });
            });
    }
}

// ── SUGGESTERS ───────────────────────────────────────────────────────────

class FolderSuggest extends AbstractInputSuggest<string> {
    private __targetEl: HTMLInputElement;
    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.__targetEl = inputEl;
        this.selectSuggestion = this.selectSuggestion.bind(this);
    }

    getSuggestions(inputStr: string): string[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const folders: string[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach(file => {
            if (file instanceof TFolder && file.path.toLowerCase().contains(lowerCaseInputStr)) {
                folders.push(file.path);
            }
        });

        return folders;
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.__targetEl) {
            this.__targetEl.value = value;
            this.__targetEl.dispatchEvent(new Event('input'));
            this.__targetEl.dispatchEvent(new Event('change'));
        }
        this.close();
    }
}

class FileSuggest extends AbstractInputSuggest<string> {
    private __targetEl: HTMLInputElement;
    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.__targetEl = inputEl;
        this.selectSuggestion = this.selectSuggestion.bind(this);
    }

    getSuggestions(inputStr: string): string[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const files: string[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach(file => {
            if (file instanceof TFile && file.path.toLowerCase().contains(lowerCaseInputStr)) {
                files.push(file.path);
            }
        });

        return files;
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.__targetEl) {
            this.__targetEl.value = value;
            this.__targetEl.dispatchEvent(new Event('input'));
            this.__targetEl.dispatchEvent(new Event('change'));
        }
        this.close();
    }
}
