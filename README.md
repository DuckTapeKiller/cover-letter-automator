# Cover Letter Automator

› Version 1.0.0
◈ Developed by DuckTapeKiller

A high-fidelity Obsidian plugin designed for senior professionals and executives. This tool automates the generation of hyper-tailored, formal cover letters and application emails by grounding AI models in your specific candidate profile and the target job description.

---

### ◈ Core Features

› Strictly Grounded Generation
The engine utilizes a mandatory "Source of Truth" injection block. AI models are strictly forbidden from hallucinating experience or skills; they must rely entirely on the data provided in your Candidate Profile and the Job Note.

› Multi-CV Library
Manage an unlimited collection of CV versions (e.g., Tech CV, Management CV, Creative CV) within the settings. Select the appropriate version dynamically during the generation process for immediate email attachment.

› Executive Tone Engineering
Hardcoded linguistic constraints enforce a direct, senior executive persona. The system automatically prohibits flowery clichés ("passionate," "keen interest," "thrilled") and banned terminology ("hone," "honed") to ensure a professional, value-first approach.

› Multi-Provider Support
Toggle between local and cloud-based intelligence per-generation:
◈ Ollama (Local/Private)
◈ Google Gemini (OpenAI Compatibility Layer)
◈ Anthropic Claude
◈ OpenAI GPT

› Dual-Export Pipeline
◈ High-Fidelity PDF: Generated with natural text flow and synchronized user-defined margins.
◈ Professional DOCX: Structured for compatibility with Applicant Tracking Systems (ATS).

› Email Automation (Desktop)
Generates a formal 2-3 sentence application email and creates a system-default .eml draft with the cover letter and selected CV already attached.

---

### ⚙ Configuration

1. ◈ Candidate Profile: Define your Presentation, Skills, Education, and Experience in the settings tab.
2. ◈ CV Library: Add your various CV vault paths to the library.
3. ◈ AI Providers: Input your API keys or Ollama URL.
4. ◈ Typography & Margins: Standardize your document layout (defaulted to 12pt body / 22pt header).

---

### » Usage

1. ◈ Open a Job Description note in Obsidian.
2. ◈ Ensure the note has YAML frontmatter with "Company" and "Job Title".
3. ◈ Click the Ribbon Icon (›) to open the Generator.
4. ◈ Select your AI Model, Export Format, and the CV version to attach.
5. ◈ Generate.

---

### ◈ Technical Specifications

› Security & Privacy
All API keys and candidate data are stored locally within your Obsidian vault settings. No data is tracked or sent to third-party servers beyond the selected AI provider.

› Mobile Stability
The plugin is engineered with runtime environment guards. While email drafting is a desktop-specific feature, the core generation and file management systems are protected against initialization crashes on iOS and Android.

---

› Distributed under the MIT License.
◈ DuckTapeKiller
