# 🤖 Vishal Khan: AI Digital Twin
**An Agentic RAG-Powered Professional Portfolio Assistant**

[![Streamlit App](https://static.streamlit.io/badges/streamlit_badge_svg)](https://my-ai-resume-hw2ve8yygftf4ynycfzfea.streamlit.app/)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Overview
This project is an **AI-powered Digital Twin** designed to provide recruiters and collaborators with an interactive, 24/7 gateway into my professional background. Moving beyond the static PDF, this assistant leverages Generative AI to answer specific questions about my career as a Data Engineer, my research at **Northeastern University London**, and my technical contributions on **GitHub**.



## 🚀 Key Features
* **Context-Aware Chat:** Uses Retrieval-Augmented Generation (RAG) to fetch precise details from my academic and professional history (PDF-based memory).
* **Agentic Reasoning:** Powered by LangChain, the assistant decides when to search my resume, when to check live code on GitHub, and when to verify my status via LinkedIn.
* **Live API Integration:**
    * **GitHub API:** Fetches real-time repository data to showcase current coding activity.
    * **LinkedIn Status:** Displays verified professional status and current location.
    * **Tavily Search:** Enables the assistant to search the web for my latest public projects or news.
* **Dynamic UX:** Features a custom-styled "Light Mode" interface with animated "Quick Inquiry" pills that refresh dynamically.

## 🏗️ Tech Stack
* **LLM Engine:** Google Gemini 2.0 Flash
* **Orchestration:** LangChain (Tool-calling Agent)
* **Vector Database:** FAISS
* **Embeddings:** Google Generative AI Embeddings
* **UI/UX:** Streamlit with Custom CSS injection

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/DataScienceVishal/my-ai-resume.git](https://github.com/DataScienceVishal/my-ai-resume.git)
   cd my-ai-resume
