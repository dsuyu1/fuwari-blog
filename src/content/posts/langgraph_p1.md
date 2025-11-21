---
title: "LangGraph Series Part 1: Building Intelligent Workflows"
published: 2025-11-11T00:00:00-08:00
description: I aim to build hands-on familiarity with LangGraph and LangChain, exploring how agentic systems can be designed, orchestrated, and applied to real-world problems.
tags: [LangChain, LangGraph, Agentic AI, Python]
category: Artificial Intelligence
draft: false
---

# Welcome to the LangGraph & LangChain Project Series! 
As employees in the 21st century, we face an inevitable reality: artificial intelligence is transforming the workplace faster than ever before. I don’t believe it’s a matter of if our jobs will be affected — it’s a matter of when. In China, AI-powered robots now assemble cars in “dark factories,” where production continues around the clock without the need for human supervision — or even lights. Intelligent AI agents aren’t just coming; they’re already here.

As a cybersecurity analyst, I recognize that my field is no exception. Many of the tasks we perform today can and likely will be automated by intelligent agents. That’s why I believe it’s essential for professionals like us to understand how these systems work — not to fear them, but to learn how to design, maintain, and secure them. If we want to stay relevant in the era of autonomous agents, we need to be the ones building and managing them.

This project marks my first step in that direction. Through a series of experiments and workflows, I aim to build hands-on familiarity with LangGraph and LangChain, exploring how agentic systems can be designed, orchestrated, and applied to real-world problems.

A special thanks to [Mr. Hacker Loi](https://youtu.be/rfPsjqNbWyA?si=iMXEsQFLkX4wr_v4).

## Overview
According to [LangChain's official documentation](https://docs.langchain.com/oss/python/langgraph/workflows-agents):

> **Workflows** have predetermined code paths and are designed to operate in a certain order.
> **Agents** are dynamic and define their own processes and tool usage.

This repository is part of my ongoing series of projects designed to build **familiarity with LangGraph** and **LangChain**—two powerful frameworks for developing **AI-driven systems** that combine reasoning, memory, and structured task orchestration.  

Each part of this series focuses on a specific aspect of intelligent agent design, starting from static, rule-based workflows and progressing toward dynamic, autonomous AI agents.

## Goals

- Understand how **LangGraph** structures logic using **states**, **nodes**, and **edges**  
- Learn to design **workflows** that control and monitor AI behavior predictably  
- Gain practical experience integrating **LLMs**, **retrieval tools**, and **self-evaluation loops**  
- Transition from **workflows** → **multi-agent systems** capable of decision-making and collaboration  

---

# Introduction to Workflows with LangGraph
<div align="center">

![workflow](src/assets/images/langgraph/agenticworkflow.png)

<small>

In this project, I build a workflow using LangGraph. I will use [this](https://youtu.be/mRx12jkugTE?si=48OSoke3ebptm8gn) tutorial from Venelin Valkov as   a guide. However, my implementation is unique and is working as of today's date (11/1/2025). You can read the full documentation of the tutorial [here](https://www.mlexpert.io/academy/v1/ai-agents/langgraph-getting-started). 

</small>

</div>

According to [LangChain's official documentation](https://docs.langchain.com/oss/python/langgraph/workflows-agents):

> **Workflows** have predetermined code paths and are designed to operate in a certain order.
> **Agents** are dynamic and define their own processes and tool usage.

I'll build two implementations of the IT support ticket system - one with workflows and the other with AI agents to understand the differences and use cases.

The LangGraph library is focused around building workflows and AI agents.

As previously mentioned, our use case is an **intelligent support ticket triage**.

### Goals
- Master the three core LangGraph building blocks: State, Nodes, and Edges
- Build a complete support ticket system using the structured workflow pattern
- Rebuild the same system as an autonomous agent to see the key differences
- Implement automated quality control with evaluator-feedback loops
- Add human oversight checkpoints to prevent costly AI mistakes

### Problem Statement

Our company is drowning in support tickets. The IT team could use some help! ⚠️

### Proposed Solution

Intelligent ticket processing that:

* Classifies the ticket type (technical, billing, general)
* Retrieves relevant solutions from a knowledge base
* Drafts helpful responses using found information
* Reviews and revises its own work until quality standards are met

The system is rule-based enough to be predictable, complex enough to need orchestration.

### Why don't we just use simple LLM calls?

Simple LLM calls that use if/else statements and loops are fine for systems with 1-2 nodes, but managing and maintaining a complex system with just if/else and loops is too cumbersome. Business logic gets buried, and manual state management is a pain.

LangGraph gives us **three** building blocks to design AI systems like production workflows:

* **State**: This is the system's memory 🧠. The state tracks everything from `ticket_text` to `draft_response`.
* **Nodes**: Nodes are Python functions that do one job well. For example `classify_ticket`, `draft_response`, `evaluate_draft`.
* **Edges**: The paths between the nodes. They are direct connections or conditional logic.

### Workflows vs. Agents: Who's in Control?

| Workflows                              | Agents                                         |
| -------------------------------------- | ---------------------------------------------- |
| Developer controls every step          | LLM decides the strategy                       |
| Fixed, predictable path                | Dynamic ReAct loop (Reason -> Act -> Observe)  |
| Perfect for compliance, data pipelines | Perfect for research, creative problem-solving |
| Rock solid reliability                 | Adaptive intelligence                          |

Within a workflow, as a developer, we can control every step of the process. It is easy to debug too!

AI agents are all the rage right now, but even with powerful LLMs, if we have a specific workflow that needs to be done in a specific order, agents are not able to follow through how we might want them to.

### Human-in-the-Loop: Our Safety Net

Autonomous agents are powerful but can be expensive when they go wrong. We need human oversight, especially in enterprise/production environments.

We can **add strategic checkpoints:**

* Before **high impact** actions (escalations, billing)
* When AI is **uncertain** (low confidence scores)
* Final quality gate (customer-facing responses)

For example, we can have a function that freezes the graph and waits for human review right before it escalates a ticket.

Human-in-the-loop takes a cool AI demo app to something you can actually use in production. With humans "in the loop," we can relax knowing that AI won't go crazy. :relieved:

## Workflows

We start by importing everything we need. Most of them come from LangChain. The LangGraph imports will help us build our state graphs.

```python
%pip install -Uqqq pip --progress-bar off
%pip install -Uqqq langchain --progress-bar off
%pip install -Uqqq langchain-openai --progress-bar off
%pip install -Uqqq langchain-google-genai --progress-bar off
%pip install -Uqqq langchain-ollama --progress-bar off
%pip install -Uqqq langchain-community --progress-bar off
%pip install -Uqqq pypdf --progress-bar off
%pip install -Uqqq fastembed --progress-bar off
%pip install -Uqqq langgraph --progress-bar off
%pip install -Uqqq langchain-core --progress-bar off
```

```python
# Used to easily create classes for storing data.
from dataclasses import dataclass, field
# Provides type hints for better code readability and maintainability.
from typing import Annotated, List, TypedDict
# Used to display images and other rich output in IPython/Colab.
from IPython.display import Image, display
# Initializes a chat model for language model interactions.
from langchain.chat_models import init_chat_model
# Provides fast and efficient embeddings for text.
from langchain_community.embeddings import HuggingFaceEmbeddings
# Represents a document object, often used in retrieval systems.
from langchain_core.documents import Document
# Represents different types of messages in a conversation.
from langchain_core.messages import AnyMessage, HumanMessage
# Creates templates for generating chat prompts.
from langchain_core.prompts import ChatPromptTemplate
# Decorator to define a function as a tool for language models.
from langchain_core.tools import tool
# An in-memory vector store for storing and searching vector embeddings.
from langchain_core.vectorstores import InMemoryVectorStore
# Components for building state graphs in LangGraph.
from langgraph.graph import END, StateGraph
# Function to add messages to the state in LangGraph.
from langgraph.graph.message import add_messages
```

Initially, I was going to use `gpt-oss`'s latest model provided by Ollama. However, I was having trouble with my API key and whatnot, so I decided to take the easiest route and just use a Hugging Face model saved locally in my Google Colab environment.

```py
from langchain_community.llms import HuggingFacePipeline
from transformers import pipeline

pipe = pipeline("text2text-generation", model="google/flan-t5-large", temperature=0.7, max_length=512)
llm = HuggingFacePipeline(pipeline=pipe)
```

### Defining the state

Think of the state as your system's memory - everything important gets stored here as it flows through your workflow. We'll use a `dataclass` to define our state. In LangChain, a `dataclass` is utilized as a method for **defining the structure of data**, particularly within the context of managing state in LangGraph.

```python
@dataclass # defines structure of our LangChain state
class TicketTriageState:
  ticket_text: str
  classification: str = ""
  retrieved_docs: List[Document] = field(default_factory=lambda: [])
  draft_response: str = ""
  evaluation_feedback: str = ""
  revision_count: int = 0
```

Here's what we're tracking:

- `ticket_text` - The original problem from the customer
- `classification` - What type of issue this is (technical, billing, etc.)
- `retrieved_docs` - Relevant solutions we found in our knowledge base
- `draft_response` - Our current attempt at a helpful response
- `evaluation_feedback` - How good our draft is (and how to improve it)
- `revision_count` - How many times we've tried to improve the response

### A quick explanation of nodes in LangGraph

In LangGraph, a **node** is a *function* that represents a single unit of computation or a specific step in a workflow.

### Classification of the prompt

```python
CLASSIFY_PROMPT = """
Classify this support ticket into one of the following categories:
'Technical Issue', 'Billing Inquiry', 'General Question'.

<ticket>
{ticket_text}
</ticket>
""".strip()

def classify_ticket(state: TicketTriageState) -> dict:
  classification = llm.invoke(CLASSIFY_PROMPT.format(ticket_text=state.ticket_text))
  return {"classification": classification}
```

### Contacting the knowledge base

```python
from langchain_community.embeddings import FastEmbedEmbeddings

knowledge_base = [
    "For login issues, tell the user to try resetting their password via the 'Forgot Password' link.",
    "Billing inquiries should be escalated to the billing department by creating a ticket in Salesforce.",
    "The app is known to crash on startup if the user's cache is corrupted. The standard fix is to clear the application cache.",
]
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

vector_store = InMemoryVectorStore.from_texts(knowledge_base, embeddings)
retriever = vector_store.as_retriever()


def retrieve_knowledge(state: TicketTriageState) -> dict:
    retrieved_docs = retriever.invoke(state.ticket_text)
    return {"retrieved_docs": retrieved_docs}
```

### Drafting the response

```python
DRAFT_PROMPT = """
Based on this context:
<context>
{context}
</context>

Draft a response for this ticket:
<ticket>
{ticket}
</ticket>
""".strip()

def draft_response(state: TicketTriageState) -> dict:
  context = "\n".join([doc.page_content for doc in state.retrieved_docs])
  prompt = DRAFT_PROMPT.format(context=context, ticket=state.ticket_text)
  draft = llm.invoke(prompt)
  return {"draft_response": draft}
```

### Response evaluation

```python
EVALUATE_PROMPT = """
Does this draft
<draft>
{draft_response}
</draft>

fully address the ticket

<ticket>
{ticket_text}
</ticket>

If not, provide feedback.
Respond with 'PASS' or 'FAIL: [feedback]'."
""".strip()

def evaluate_draft(state: TicketTriageState) -> dict:
  evaluation_prompt = EVALUATE_PROMPT.format(
    draft_response=state.draft_response,
    ticket_text=state.ticket_text,
  )
  evaluation_result = llm.invoke(evaluation_prompt)
  revision_count = state.revision_count + 1
  return {"evaluation_feedback": evaluation_result, "revision_count": revision_count}
```

### Revising the response draft

```python
REVISE_PROMPT = """
Revise this draft:
<draft>
{draft_response}
</draft>

based on the following feedback:

<feedback>
{evaluation_feedback}
</feedback>
""".strip()

def revise_response(state: TicketTriageState) -> dict:
  revise_prompt = REVISE_PROMPT.format(
    draft_response=state.draft_response,
    evaluation_feedback=state.evaluation_feedback,
  )
  return {"draft_response": llm.invoke(revise_prompt)}
```

### If "FAIL," revise

```python
def should_revise(state: TicketTriageState) -> str:
    feedback = state.evaluation_feedback
    revision_count = state.revision_count

    if "FAIL" in feedback and revision_count < 3:
        return "revise"
    else:
        return "end"
```

### Generating our graph

```python
graph = StateGraph(TicketTriageState)

graph.add_node("classify", classify_ticket)
graph.add_node("retrieve", retrieve_knowledge)
graph.add_node("draft", draft_response)
graph.add_node("evaluate", evaluate_draft)
graph.add_node("revise", revise_response)

graph.add_edge("classify", "retrieve")
graph.add_edge("retrieve", "draft")
graph.add_edge("draft", "evaluate")
graph.add_edge("revise", "evaluate")

graph.add_conditional_edges(
    "evaluate",
    should_revise,
    {
        "revise": "revise",
        "end": END,
    },
)

graph.set_entry_point("classify")
app = graph.compile()
```

### Displaying the graph

```python
display(Image(app.get_graph().draw_mermaid_png()))
```
<div align="center">

![Graph](src/assets/images/langgraph/graph2.png)

</div>

### Running the workflow

```py
initial_state = { 
    "ticket_text": "My login is broken, please help!",
    "retrieved_docs": [],
    "classification": "",
    "draft_response": ""
}

final_state = app.invoke(initial_state) 

print("=== TICKET TRIAGE RESULTS ===")
print(f"Original Ticket: {final_state['ticket_text']}")
print(f"Classification: {final_state['classification']}") 
print(f"\nResponse:\n{final_state['draft_response']}")
```

### Printing the final classification

```py
print(final_state["classification"])
```

### Printing the revision count

```py
print(final_state["revision_count"])
```

### Print the draft of the response

```py
print(final_state["draft_response"])
```

The response from the model was:

> For login issues, tell the user to try resetting their password via the 'Forgot Password' link. The app is known to crash on startup if the user's cache is corrupted. The standard fix is to clear the application cache. Billing inquiries should be escalated to the billing department by creating a ticket in Salesforce.

There are some issues I want to address, especially regarding the response from the model, but for now, let's call it a win and move on! ⭐

---

## Conclusion and Next Steps

In this first part, I built a deterministic workflow for IT ticket triage using LangGraph. The key insight? **Workflows give you control**. Every step is predictable, debuggable, and reliable—exactly what you want for production systems.

But workflows have limitations. What if we need adaptability? What if the LLM should *decide* its own strategy? That's where **AI agents** come in.

In **Part 2**, I'll rebuild this same system as an autonomous agent using the ReAct pattern, exploring how dynamic decision-making changes everything.

[View the complete code on GitHub.](https://github.com/dsuyu1/workflows-and-agents-with-langgraph/blob/10494491d520988353d32089dbc28a5e50f82e5b/Part%201%3A%20Workflows/workflow_part1.ipynb)