import { Plugin, TFile, Notice, Modal, App, setIcon, requestUrl } from 'obsidian';
// electron/node imports moved inside functions to prevent mobile crashes
import {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, TableBorders
} from 'docx';
import html2pdf from 'html2pdf.js';
import { Platform } from 'obsidian';
import { CoverLetterSettings, DEFAULT_SETTINGS, CoverLetterSettingTab } from './settings';

// ─── Constants ───────────────────────────────────────────────────────────────

export const PROVIDER_MODELS: Record<string, string[]> = {
    gemini: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-pro'],
    claude: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']
};

export const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
    'en-GB': 'Strictly BRITISH ENGLISH. Use "specialise", "organise", "programme", "colour", "honour".',
    'es': 'Strictly SPANISH. Use professional, formal, and natural Spanish (Neutral/Spain).',
    'en-US': 'Strictly AMERICAN ENGLISH. Use "specialize", "organize", "program", "color", "honor".'
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeneratedFile {
    path: string;           // vault-relative path
    data: ArrayBuffer;
    name: string;
    mimeType: string;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default class CoverLetterPlugin extends Plugin {
    settings!: CoverLetterSettings;
    statusBarItem!: HTMLElement;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new CoverLetterSettingTab(this.app, this));

        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass('cla-status-bar');
        this.updateStatusBar('Ready');

        this.addRibbonIcon('paper-plane', 'Cover Letter Automator', () => {
            const f = this.app.workspace.getActiveFile();
            if (f?.extension === 'md') new GeneratorModal(this.app, this, f).open();
            else new Notice('Please open a job note first.');
        });

        this.addCommand({
            id: 'generate-cover-letter',
            name: 'Generate Cover Letter',
            callback: () => {
                const f = this.app.workspace.getActiveFile();
                if (f) new GeneratorModal(this.app, this, f).open();
            }
        });

        const addMenuItem = (menu: any, file: TFile) =>
            menu.addItem((item: any) =>
                item.setTitle('Generate Cover Letter')
                    .setIcon('paper-plane')
                    .onClick(() => new GeneratorModal(this.app, this, file).open())
            );

        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof TFile && file.extension === 'md') addMenuItem(menu, file);
        }));
        this.registerEvent(this.app.workspace.on('editor-menu', (menu, _ed, view) => {
            if (view.file instanceof TFile) addMenuItem(menu, view.file);
        }));

        this.registerMarkdownCodeBlockProcessor('generate-cl', (_src, el) => {
            el.createDiv({ cls: 'cla-button-container' })
                .createEl('button', { text: 'GENERATE COVER LETTER NOW', cls: 'cla-generate-btn' })
                .onclick = () => {
                    const f = this.app.workspace.getActiveFile();
                    if (f) new GeneratorModal(this.app, this, f).open();
                    else new Notice('No active file found.');
                };
        });

        console.log('Cover Letter Automator loaded');
    }

    updateStatusBar(text: string, pulse = false) {
        this.statusBarItem.setText(`CL: ${text}`);
        pulse ? this.statusBarItem.addClass('cla-pulse') : this.statusBarItem.removeClass('cla-pulse');
    }

    // ─── File processing ─────────────────────────────────────────────────────

    async processFile(
        file: TFile,
        onProgress: (pct: number) => void,
        selectedField: string,
        format: 'DOCX' | 'PDF',
        modelOverride?: string,
        providerOverride?: string
    ): Promise<GeneratedFile> {
        onProgress(10);
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        let jobPost = fm.Content as string || '';
        if (!jobPost) {
            const raw = await this.app.vault.read(file);
            jobPost = raw.replace(/^---[\s\S]*?---\n*/, '').replace(/\[\[.*?\]\]/g, '').trim();
        }

        onProgress(30);
        let aiText = await this.generateWithAI(jobPost, modelOverride, providerOverride);
        aiText = aiText
            .replace(/```(?:markdown|docx|text|plain)?\n?/gi, '')
            .replace(/```/g, '')
            .trim();

        onProgress(80);
        const result = format === 'PDF'
            ? await this.createPdf(file, aiText, fm, selectedField)
            : await this.createDocx(file, aiText, fm, selectedField);

        onProgress(100);
        this.updateStatusBar('Done');
        return result;
    }

    // ─── AI providers ────────────────────────────────────────────────────────

    async generateWithAI(content: string, modelOverride?: string, providerOverride?: string, isEmail = false): Promise<string> {
        const prompt = isEmail ? content : PromptBuilder.buildCoverLetterPrompt(content, this.settings);
        const provider = providerOverride || this.settings.aiProvider;
        switch (provider) {
            case 'claude':  return this.callClaude(prompt, modelOverride);
            case 'gemini':  return this.callGemini(prompt, modelOverride);
            case 'openai':  return this.callOpenAI(prompt, modelOverride);
            default:        return this.callOllama(prompt, modelOverride);
        }
    }

    private async callOllama(prompt: string, modelOverride?: string): Promise<string> {
        const url = `${this.settings.ollamaUrl.replace(/\/$/, '')}/api/generate`;
        let res: Response;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelOverride || this.settings.modelName,
                    prompt,
                    stream: false,
                    options: { temperature: 0.4, num_predict: 2048 }
                })
            });
        } catch (e: unknown) {
            throw new Error(`Ollama unreachable — is it running? (${(e as Error).message})`);
        }
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        if (!data.response) throw new Error('Ollama returned an empty response.');
        return data.response as string;
    }

    private async callClaude(prompt: string, modelOverride?: string): Promise<string> {
        if (!this.settings.claudeApiKey) throw new Error('No Anthropic API key — add it in Settings → AI Provider.');
        let res: Response;
        try {
            res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.settings.claudeApiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: modelOverride || this.settings.claudeModel || 'claude-3-5-haiku-latest',
                    max_tokens: 2048,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
        } catch (e: unknown) {
            throw new Error(`Claude API error: ${(e as Error).message}`);
        }
        if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const text = data?.content?.[0]?.text as string | undefined;
        if (!text) throw new Error('Claude returned an empty response.');
        return text;
    }

    private async callGemini(prompt: string, modelOverride?: string): Promise<string> {
        if (!this.settings.geminiApiKey) throw new Error('No Google API key — add it in Settings → AI Provider.');
        const model = modelOverride || this.settings.geminiModel || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.geminiApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.4,
                    max_tokens: 2048
                })
            });
            const data = response.json;
            const text = data?.choices?.[0]?.message?.content as string | undefined;
            if (!text) throw new Error('Gemini returned an empty response.');
            return text;
        } catch (e: unknown) {
            const errorData = (e as any).response?.text;
            throw new Error(`Gemini API error: ${errorData || (e as Error).message}`);
        }
    }

    private async callOpenAI(prompt: string, modelOverride?: string): Promise<string> {
        if (!this.settings.openaiApiKey) throw new Error('No OpenAI API key — add it in Settings → AI Provider.');
        let res: Response;
        try {
            res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: modelOverride || this.settings.openaiModel || 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.4,
                    max_tokens: 2048
                })
            });
        } catch (e: unknown) {
            throw new Error(`OpenAI API error: ${(e as Error).message}`);
        }
        if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content as string | undefined;
        if (!text) throw new Error('OpenAI returned an empty response.');
        return text;
    }

    // ─── Body cleaning ───────────────────────────────────────────────────────

    cleanBodyLines(aiResponse: string, company: string, jobTitle: string): string[] {
        const compLow  = company.toLowerCase();
        const titleLow = jobTitle.toLowerCase();
        const out: string[] = [];
        let started = false;

        for (const raw of aiResponse.trim().split(/\n+/)) {
            const line = raw.trim();
            const low  = line.toLowerCase();
            if (!line) continue;
            if (!started) {
                if (low.startsWith('dear ') || low.includes('sir/madam') || low.includes('whom it may concern')) continue;
                if (low.startsWith('subject:') || low.startsWith('re:')) continue;
                if ((compLow && low.includes(compLow) || titleLow && low.includes(titleLow)) && line.length < 60) continue;
                if (line.length < 30) continue;
                started = true;
            }
            out.push(line);
        }
        return out;
    }

    // ─── DOCX ────────────────────────────────────────────────────────────────

    async createDocx(
        sourceFile: TFile,
        aiResponse: string,
        data: Record<string, unknown>,
        selectedField: string
    ): Promise<GeneratedFile> {
        const FONT    = this.settings.fontName || 'Lora';
        const contact = (data.Contact     as string) || 'Hiring Manager';
        const title   = ((data['Job Title'] as string) || 'Position').trim();
        const company = ((data.Company     as string) || 'Company').trim();
        const address = (data.Address      as string) || '';

        const toTitleCase = (s: string) => s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const displayTitle = (title === title.toUpperCase()) ? toTitleCase(title) : title;

        const run = (text: string, size = 24, bold = false) =>
            new TextRun({ text, font: FONT, size, bold });

        const doc = new Document({
            background: { color: 'FFFFFF' },
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top:    this.settings.marginSize,
                            right:  this.settings.marginSize,
                            bottom: this.settings.marginSize,
                            left:   this.settings.marginSize
                        }
                    }
                },
                children: [
                    new Paragraph({
                        children: [run(selectedField.toUpperCase(), 24)], // 12pt
                        spacing: { before: 0, after: 40 }
                    }),
                    new Paragraph({
                        children: [run(this.settings.senderName, 44, true)], // 22pt
                        spacing: { before: 0, after: 0 }
                    }),
                    new Paragraph({
                        children: [run(`T: ${this.settings.senderPhone}  //  E: ${this.settings.senderEmail}  //  Role: ${displayTitle}`, 24)], // 12pt
                        spacing: { before: 40, after: 200 }
                    }),
                    new Paragraph({ children: [run(company, 24, true)], spacing: { before: 100 } }), // 12pt
                    new Paragraph({ children: [run(address, 24)], spacing: { after: 100 } }), // 12pt
                    new Paragraph({ children: [run(`Dear ${contact},`, 24)], spacing: { before: 200, after: 200 } }), // 12pt
                    ...this.cleanBodyLines(aiResponse, company, title).map(l =>
                        new Paragraph({
                            children: [run(l, 24)], // 12pt
                            spacing: { before: 80, after: 80 },
                            alignment: AlignmentType.JUSTIFIED
                        })
                    ),
                    new Paragraph({ children: [run('Regards,', 24)], spacing: { before: 300 } }), // 12pt
                    new Paragraph({ children: [run(this.settings.senderName, 24, true)] }), // 12pt
                ]
            }]
        });

        const nodeBuf = await Packer.toBuffer(doc) as Buffer;
        const arrayBuffer = nodeBuf.buffer.slice(
            nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength
        ) as ArrayBuffer;

        const fileName = `COVER LETTER - ${this.settings.senderName} - ${title}.docx`
            .replace(/[\\/:*?"<>|]/g, '');
        const filePath = await this.resolveOutputPath(sourceFile, fileName);
        const newFile  = await this.app.vault.createBinary(filePath, arrayBuffer);
        new Notice(`DOCX saved: ${filePath}`);
        this.revealFile(newFile);

        return {
            path: filePath, data: arrayBuffer, name: fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
    }

    // ─── PDF ─────────────────────────────────────────────────────────────────

    async createPdf(
        sourceFile: TFile,
        aiResponse: string,
        data: Record<string, unknown>,
        selectedField: string
    ): Promise<GeneratedFile> {
        const FONT      = this.settings.fontName || 'Lora';
        const marginMm  = (this.settings.marginSize / 1440) * 25.4;
        const title     = ((data['Job Title'] as string) || 'Position').trim();
        const contact   = (data.Contact  as string) || 'Hiring Manager';
        const company   = (data.Company  as string) || '';
        const address   = (data.Address  as string) || '';

        const toTitleCase = (s: string) => s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const displayTitle = (title === title.toUpperCase()) ? toTitleCase(title) : title;

        const esc = (s: string) => s
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const bodyHtml = this.cleanBodyLines(aiResponse, company, title)
            .map(l => `<p style="margin:0 0 11px 0;text-align:justify;orphans:3;widows:3;">${esc(l)}</p>`)
            .join('');

        const div = document.createElement('div');
        div.style.cssText = `font-family:"${esc(FONT)}",Georgia,"Times New Roman",serif;font-size:12pt;line-height:1.6;color:#000;background:#fff`;
        div.innerHTML = `
            <div style="font-size:12pt;margin-bottom:2px;opacity:0.65;letter-spacing:0.06em;">${esc(selectedField.toUpperCase())}</div>
            <div style="font-size:22pt;font-weight:bold;margin-bottom:0px;">${esc(this.settings.senderName)}</div>
            <div style="font-size:12pt;border-bottom:1px solid rgba(0,0,0,0.1);padding-bottom:6px;margin-bottom:12px;">
                T:&nbsp;${esc(this.settings.senderPhone)}&nbsp;&nbsp;//&nbsp;&nbsp;E:&nbsp;${esc(this.settings.senderEmail)}&nbsp;&nbsp;//&nbsp;&nbsp;Role:&nbsp;${esc(displayTitle)}
            </div>
            <div style="font-weight:bold;margin-bottom:1px;font-size:12pt;">${esc(company)}</div>
            <div style="margin-bottom:10px;white-space:pre-wrap;font-size:12pt;">${esc(address)}</div>
            <div style="margin-bottom:12px;font-size:12pt;">Dear ${esc(contact)},</div>
            <div style="font-size:12pt;">${bodyHtml}</div>
            <div style="margin-top:24px;page-break-inside:avoid;font-size:12pt;">
                <div>Regards,</div>
                <div style="font-weight:bold;margin-top:4px;">${esc(this.settings.senderName)}</div>
            </div>`;

        document.body.appendChild(div);
        try {
            const blob: Blob = await (html2pdf() as any).from(div).set({
                margin:      marginMm,
                filename:    'cover-letter.pdf',
                image:       { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:   { mode: 'css' }
            }).output('blob');
            document.body.removeChild(div);

            const arrayBuffer = await blob.arrayBuffer();
            const fileName    = `COVER LETTER - ${this.settings.senderName} - ${title}.pdf`
                .replace(/[\\/:*?"<>|]/g, '');
            const filePath    = await this.resolveOutputPath(sourceFile, fileName);
            const newFile     = await this.app.vault.createBinary(filePath, arrayBuffer);
            new Notice(`PDF saved: ${filePath}`);
            this.revealFile(newFile);
            return { path: filePath, data: arrayBuffer, name: fileName, mimeType: 'application/pdf' };
        } catch (e: unknown) {
            if (div.parentNode) document.body.removeChild(div);
            throw new Error(`PDF failed: ${(e as Error).message}`);
        }
    }

    // ─── Email ───────────────────────────────────────────────────────────────

    /** Generates a 2-3 sentence email body via the active AI provider. */
    async generateEmailBody(frontmatter: Record<string, unknown>): Promise<string> {
        const prompt = PromptBuilder.buildEmailPrompt(frontmatter, this.settings);
        try {
            return await this.generateWithAI(prompt, undefined, undefined, true);
        } catch {
            const title   = (frontmatter['Job Title'] as string) || 'the position';
            const company = (frontmatter.Company      as string) || 'your organisation';
            return `Please find attached my CV and cover letter in application for the ${title} position at ${company}. I would welcome the opportunity to discuss my suitability at your earliest convenience.`;
        }
    }

    async openMailDraft(params: {
        to: string;
        from: string;
        subject: string;
        body: string;
        attachments: { name: string; data: ArrayBuffer; mimeType: string }[];
    }): Promise<void> {
        if (!Platform.isDesktop) {
            new Notice('Email drafting with attachments is only available on desktop.');
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { shell } = require('electron') as { shell: { openPath: (path: string) => Promise<string> } };
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs   = require('fs')   as typeof import('fs');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const os   = require('os')   as typeof import('os');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require('path') as typeof import('path');

        const { to, from, subject, body, attachments } = params;
        const boundary = `cla_${Date.now()}_boundary`;

        const toB64 = (buf: ArrayBuffer): string => {
            const bytes = new Uint8Array(buf);
            let bin = '';
            const chunk = 8192;
            for (let i = 0; i < bytes.length; i += chunk)
                bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
            return btoa(bin);
        };
        const strToB64 = (s: string): string =>
            toB64(new TextEncoder().encode(s).buffer as ArrayBuffer);

        const encodeHeader = (s: string) => `=?UTF-8?B?${strToB64(s)}?=`;
        const encodeParam = (s: string) => `UTF-8''${encodeURIComponent(s)}`;

        const parts: string[] = [
            `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${strToB64(body + '\r\n\r\n')}`
        ];
        for (const att of attachments) {
            const encodedName = encodeParam(att.name);
            parts.push(
                `--${boundary}\r\n` +
                `Content-Type: ${att.mimeType}; name*=${encodedName}\r\n` +
                `Content-Transfer-Encoding: base64\r\n` +
                `Content-Disposition: attachment; filename*=${encodedName}\r\n\r\n` +
                toB64(att.data)
            );
        }
        parts.push(`--${boundary}--`);

        const eml = [
            `X-Unsent: 1`,
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${encodeHeader(subject)}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            ...parts
        ].join('\r\n');

        try {
            const tmpFile = path.join(os.tmpdir(), `cover-letter-draft-${Date.now()}.eml`);
            fs.writeFileSync(tmpFile, eml, 'utf8');
            const err = await shell.openPath(tmpFile);
            if (err) throw new Error(`Could not open mail client: ${err}`);
        } catch (e: unknown) {
            throw new Error(`Desktop integration failed: ${(e as Error).message}`);
        }
    }

    getAbsolutePath(vaultRelativePath: string): string {
        if (!Platform.isDesktop) return vaultRelativePath;
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require('path') as typeof import('path');
        const adapter = this.app.vault.adapter as any;
        const basePath: string = adapter.getBasePath?.() ?? '';
        return path.join(basePath, vaultRelativePath);
    }

    private async resolveOutputPath(sourceFile: TFile, fileName: string): Promise<string> {
        const folder = this.settings.outputFolder.trim() || sourceFile.parent?.path || '';
        const base   = folder === '' || folder === '/' ? fileName : `${folder}/${fileName}`;
        if (folder && folder !== '/' && !(await this.app.vault.adapter.exists(folder))) {
            await this.app.vault.createFolder(folder);
        }
        if (await this.app.vault.adapter.exists(base)) {
            const dot = base.lastIndexOf('.');
            return `${base.slice(0, dot)}_${Date.now()}${base.slice(dot)}`;
        }
        return base;
    }

    private revealFile(file: TFile) {
        const explorer = (this.app as any).internalPlugins?.plugins['file-explorer'];
        if (explorer?.enabled) explorer.instance.revealInFolder(file);
    }

    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() { await this.saveData(this.settings); }
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

class PromptBuilder {
    static getLanguageStr(lang: string): string {
        return LANGUAGE_INSTRUCTIONS[lang] || LANGUAGE_INSTRUCTIONS['en-GB'];
    }

    static buildCoverLetterPrompt(jobContent: string, settings: CoverLetterSettings): string {
        const langStr = this.getLanguageStr(settings.language);
        const profile = `
CANDIDATE DATA (YOUR ONLY SOURCE FOR FACTS):
PROFILE: ${settings.candidateProfile || 'Not provided'}
SKILLS: ${settings.candidateSkills || 'Not provided'}
EDUCATION: ${settings.candidateEducation || 'Not provided'}
EXPERIENCE: ${settings.candidateExperience || 'Not provided'}
`;
        return `You are a Senior Professional Cover Letter Writer. 

${profile}

Write a detailed, persuasive, and tailored cover letter of exactly 4 to 5 paragraphs based on the JOB INFO below and the CANDIDATE DATA above.

CRITICAL INSTRUCTIONS:
1. NO HALLUCINATIONS: Use ONLY the Candidate Data provided. Do NOT invent skills, roles, or achievements.
2. TONE: Senior Executive, Formal, and Direct. 
3. STYLE CONSTRAINTS: Avoid overly enthusiastic or "flowery" language. Do NOT use phrases like "keen interest", "profoundly excited", "passionate", "hone", "honed", or "I am writing to express my interest". Start immediately with the value proposition.
4. LANGUAGE: ${langStr}
5. NO SIGNATURE: Do NOT write "Regards" or your name at the end. ONLY write the body paragraphs.
6. NO PLACEHOLDERS: Do not use [Your Name], [Company], etc.
7. STRUCTURE: 
   - Paragraph 1: Direct opening focused on the role and value.
   - Paragraph 2-3: Detailed analysis of how Candidate Data matches Job Requirements.
   - Paragraph 4: Strategic motivation for the company.
   - Paragraph 5: Professional call to action.

JOB INFO:
${jobContent}`;
    }

    static buildEmailPrompt(frontmatter: Record<string, any>, settings: CoverLetterSettings): string {
        const title   = (frontmatter['Job Title'] as string) || 'the position';
        const company = (frontmatter.Company      as string) || 'your organisation';
        const contact = (frontmatter.Contact      as string) || '';
        const ref     = frontmatter.Ref ? ` (Ref: ${frontmatter.Ref as string})` : '';

        return `Write a short, formal email body for a job application. Return ONLY the body text — no greeting, no sign-off, no subject line.

Job Title: ${title}${ref}
Company: ${company}${contact ? `\nContact: ${contact}` : ''}
Sender: ${settings.senderName}

Requirements:
- 2 to 3 sentences only
- TONE: Senior Executive, Formal.
- STYLE: Avoid "enthusiastic" words like "excited", "passionate", or "thrilled". 
- State interest in the role; mention CV and cover letter are attached
- Do not begin with "I am writing to"`;
    }
}

// ─── Generator Modal ─────────────────────────────────────────────────────────

class GeneratorModal extends Modal {
    constructor(app: App, private plugin: CoverLetterPlugin, private file: TFile) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('cla-modal');
        contentEl.createEl('h1', { text: 'Cover Letter Automator', cls: 'cla-title' });
        contentEl.createEl('p', { text: `Note: ${this.file.basename}`, cls: 'cla-subtitle' });

        const c = contentEl.createDiv({ cls: 'cla-modal-container' });

        c.createEl('label', { text: 'Professional Field:', cls: 'cla-label' });
        const fieldSel = c.createEl('select', { cls: 'cla-select' });
        this.plugin.settings.professionalFields.forEach(f => {
            const opt = fieldSel.createEl('option', { text: f, value: f });
            if (f === this.plugin.settings.defaultField) opt.selected = true;
        });
        fieldSel.createEl('option', { text: '+ Add Custom…', value: 'CUSTOM' });

        const customIn = c.createEl('input', { type: 'text', placeholder: 'Custom field name…', cls: 'cla-input' });
        customIn.style.display = 'none';
        fieldSel.addEventListener('change', () => {
            customIn.style.display = fieldSel.value === 'CUSTOM' ? 'block' : 'none';
        });

        c.createEl('label', { text: 'AI Provider:', cls: 'cla-label' });
        const providerSel = c.createEl('select', { cls: 'cla-select' });
        ['gemini', 'openai', 'claude', 'ollama'].forEach(p => {
            const opt = providerSel.createEl('option', { text: p.toUpperCase(), value: p });
            if (p === this.plugin.settings.aiProvider) opt.selected = true;
        });

        c.createEl('label', { text: 'Model:', cls: 'cla-label' });
        const modelSel = c.createEl('select', { cls: 'cla-select' });

        const updateModels = () => {
            modelSel.empty();
            const provider = providerSel.value;
            const models = PROVIDER_MODELS[provider] || [];
            
            if (models.length > 0) {
                models.forEach(m => {
                    const opt = modelSel.createEl('option', { text: m, value: m });
                    if (provider === 'gemini' && m === this.plugin.settings.geminiModel) opt.selected = true;
                    if (provider === 'claude' && m === this.plugin.settings.claudeModel) opt.selected = true;
                    if (provider === 'openai' && m === this.plugin.settings.openaiModel) opt.selected = true;
                });
            } else {
                modelSel.createEl('option', { text: this.plugin.settings.modelName, value: this.plugin.settings.modelName });
            }
        };

        updateModels();
        providerSel.addEventListener('change', updateModels);

        c.createEl('label', { text: 'Export Format:', cls: 'cla-label' });
        const fmtSel = c.createEl('select', { cls: 'cla-select' });
        fmtSel.createEl('option', { text: 'PDF Document (.pdf)', value: 'PDF' });
        fmtSel.createEl('option', { text: 'Word Document (.docx)', value: 'DOCX' });
        
        c.createEl('label', { text: 'CV to Attach:', cls: 'cla-label' });
        const cvSel = c.createEl('select', { cls: 'cla-select' });
        this.plugin.settings.cvPaths.forEach(cv => {
            cvSel.createEl('option', { text: cv.name, value: cv.path });
        });
        if (this.plugin.settings.cvPaths.length === 0) {
            cvSel.createEl('option', { text: 'No CVs in Library — Check Settings', value: '' });
        }

        const progWrap = c.createDiv({ cls: 'cla-progress-container' });
        const progBar  = progWrap.createDiv({ cls: 'cla-progress-bar' });
        progBar.style.width = '0%';
        const status = c.createEl('p', { text: 'Ready.', cls: 'cla-status-text' });
        const btn    = c.createEl('button', { text: 'Generate Cover Letter', cls: 'cla-btn' });

        btn.addEventListener('click', async () => {
            let field = fieldSel.value;
            const fmt = fmtSel.value as 'DOCX' | 'PDF';
            const provider = providerSel.value;
            const model = modelSel.value;
            const cvPath = cvSel.value;

            if (field === 'CUSTOM') {
                field = customIn.value.trim();
                if (!field) { new Notice('Please enter a professional field name.'); return; }
                if (!this.plugin.settings.professionalFields.includes(field)) {
                    this.plugin.settings.professionalFields.push(field);
                    await this.plugin.saveSettings();
                }
            }

            btn.disabled = true;
            btn.setText('Working…');
            status.setText('Calling AI…');

            try {
                const result = await this.plugin.processFile(
                    this.file,
                    pct => {
                        progBar.style.width = `${pct}%`;
                        if (pct > 40) status.setText('Drafting body…');
                        if (pct > 80) status.setText(`Saving ${fmt}…`);
                    },
                    field,
                    fmt,
                    model,
                    provider
                );
                status.setText('Done — file saved.');
                btn.setText('Done!');

                const fm = this.plugin.app.metadataCache.getFileCache(this.file)?.frontmatter ?? {};
                setTimeout(() => {
                    this.close();
                    new EmailDraftModal(this.app, this.plugin, fm, result, cvPath).open();
                }, 600);
            } catch (e: unknown) {
                status.setText(`Error: ${(e as Error).message}`);
                btn.disabled = false;
                btn.setText('Retry');
            }
        });
    }

    onClose() { this.contentEl.empty(); }
}

// ─── Email Draft Modal ───────────────────────────────────────────────────────

class EmailDraftModal extends Modal {
    constructor(
        app: App,
        private plugin: CoverLetterPlugin,
        private frontmatter: Record<string, unknown>,
        private coverLetterFile: GeneratedFile,
        private cvPath: string
    ) { super(app); }

    async onOpen() {
        const { contentEl } = this;
        contentEl.addClass('cla-modal');
        const titleEl = contentEl.createEl('h1', { cls: 'cla-title' });
        setIcon(titleEl, 'mail');
        titleEl.createSpan({ text: ' Send Application Email' });

        const c = contentEl.createDiv({ cls: 'cla-modal-container' });

        const jobTitle = (this.frontmatter['Job Title'] as string) || 'Position';
        const ref      = this.frontmatter.Ref ? ` - Ref ${this.frontmatter.Ref as string}` : '';

        // — From —
        c.createEl('label', { text: 'From:', cls: 'cla-label' });
        const fromIn = c.createEl('input', { type: 'email', cls: 'cla-input' });
        fromIn.value = this.plugin.settings.senderEmail || '';

        // — To —
        c.createEl('label', { text: 'To:', cls: 'cla-label' });
        const toIn = c.createEl('input', { type: 'email', cls: 'cla-input' });
        toIn.value  = (this.frontmatter.Email as string) || (this.frontmatter.Address as string) || '';

        // — Subject —
        c.createEl('label', { text: 'Subject:', cls: 'cla-label' });
        const subIn = c.createEl('input', { type: 'text', cls: 'cla-input' });
        subIn.value = `Application: ${jobTitle}${ref} — ${this.plugin.settings.senderName}`;

        // — Body —
        c.createEl('label', { text: 'Message body:', cls: 'cla-label' });
        const bodyEl = c.createEl('textarea', { cls: 'cla-textarea' });
        bodyEl.placeholder = 'Generating with AI…';
        bodyEl.disabled    = true;

        // — Attachments — collected here so the send button can use them
        c.createEl('label', { text: 'Attachments:', cls: 'cla-label' });
        const attList = c.createDiv({ cls: 'cla-attach-list' });

        // Always attach the cover letter
        const att1 = attList.createDiv({ cls: 'cla-attach-item' });
        setIcon(att1, 'paperclip');
        att1.createSpan({ text: ` ${this.coverLetterFile.name}` });

        // Try to load the CV
        let cvData: ArrayBuffer | null   = null;
        let cvName                        = '';
        let cvMime                        = 'application/octet-stream';
        const cvPath = this.cvPath?.trim();

        if (cvPath) {
            const cvFile = this.plugin.app.vault.getAbstractFileByPath(cvPath);
            if (cvFile instanceof TFile) {
                cvName = cvFile.name;
                cvMime = cvName.endsWith('.pdf')  ? 'application/pdf'
                       : cvName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                       : 'application/octet-stream';
                const att2 = attList.createDiv({ cls: 'cla-attach-item' });
                setIcon(att2, 'paperclip');
                att2.createSpan({ text: ` ${cvName}` });
                cvData = await this.plugin.app.vault.readBinary(cvFile);
            } else {
                const attW1 = attList.createDiv({ cls: 'cla-attach-item cla-attach-warn' });
                setIcon(attW1, 'alert-triangle');
                attW1.createSpan({ text: ` CV not found: ${cvPath}` });
            }
        } else {
            const attW2 = attList.createDiv({ cls: 'cla-attach-item cla-attach-warn' });
            setIcon(attW2, 'alert-triangle');
            attW2.createSpan({ text: ' No CV path set — go to Settings → Email' });
        }

        const status = c.createEl('p', { cls: 'cla-status-text', text: '' });

        const btnRow  = c.createDiv({ cls: 'cla-btn-row' });
        const closeBtn = btnRow.createEl('button', { text: 'Close', cls: 'cla-btn cla-btn-secondary' });
        const openBtn  = btnRow.createEl('button', { text: 'Open in Mail App', cls: 'cla-btn' });
        openBtn.disabled = true;   // enabled once body generation resolves

        closeBtn.addEventListener('click', () => this.close());

        openBtn.addEventListener('click', async () => {
            const to = toIn.value.trim();
            if (!to) { new Notice('Recipient email is empty.'); return; }

            openBtn.disabled  = true;
            closeBtn.disabled = true;
            openBtn.setText('Opening…');
            status.setText('Building email draft…');

            try {
                const contact    = (this.frontmatter.Contact as string) || '';
                const salutation = contact ? `Dear ${contact},` : 'Dear Sir/Madam,';
                const fullBody   = `${salutation}\n\n${bodyEl.value.trim()}\n\nYours sincerely,\n${this.plugin.settings.senderName}`;

                const attachments: { name: string; data: ArrayBuffer; mimeType: string }[] = [
                    { name: this.coverLetterFile.name, data: this.coverLetterFile.data, mimeType: this.coverLetterFile.mimeType }
                ];
                if (cvData && cvName) attachments.push({ name: cvName, data: cvData, mimeType: cvMime });

                await this.plugin.openMailDraft({
                    to,
                    from: fromIn.value.trim(),
                    subject: subIn.value.trim(),
                    body: fullBody,
                    attachments
                });

                status.setText('Mail app opened with attachments loaded.');
                openBtn.setText('Opened ✓');
                openBtn.disabled = false;
                closeBtn.disabled = false;
            } catch (e: unknown) {
                status.setText(`Error: ${(e as Error).message}`);
                openBtn.disabled  = false;
                closeBtn.disabled = false;
                openBtn.setText('Retry');
            }
        });

        // Generate body in background — enable button when ready
        this.plugin.generateEmailBody(this.frontmatter).then(text => {
            bodyEl.value    = text;
            bodyEl.disabled = false;
            openBtn.disabled = false;
        }).catch(() => {
            bodyEl.value    = `Please find attached my CV and cover letter in application for the ${jobTitle} position. I would welcome the opportunity to discuss my suitability at your earliest convenience.`;
            bodyEl.disabled = false;
            openBtn.disabled = false;
        });
    }

    onClose() { this.contentEl.empty(); }
}