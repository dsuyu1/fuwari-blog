---
title: "Intro to Kaggle 5-Day AI Agents Intensive Course with Google"
published: 2025-11-21T00:00:00-08:00
tags: [Agentic AI, Python]
category: Artificial Intelligence
draft: false
---
# What is the 5-Day AI Agents Intensive?
> This 5-day online course was crafted by Google’s ML researchers and engineers to help developers explore the foundations and practical applications of AI agents. You’ll learn the core components – models, tools, orchestration, memory and evaluation. Finally, you’ll discover how agents move beyond LLM prototypes to become production-ready systems. Each day blends conceptual deep dives with hands-on examples, codelabs, and live discussions. By the end, you’ll be ready to build, evaluate, and deploy agents that solve real-world problems. 

---

# Day 1a (Introduction to Agents)
In Day 1a, we're introduced to the concept of agents. Unlike a classic LLM that simply takes a prompt and returns text, an agent _thinks_ about the prompt, reasons, uses the provided tools, and observes the final result.

`Prompt -> Agent -> Thought -> Action -> Observation -> Final Answer`

> In the Agent Development Kit (ADK), an Agent is a self-contained execution unit designed to act autonomously to achieve specific goals. Agents can perform tasks, interact with users, utilize external tools, and coordinate with other agents.

We'll use these main properties to define our agent:

- name and description: A simple name and description to identify our agent.
- model: The specific LLM that will power the agent's reasoning. We'll use "gemini-2.5-flash-lite".
- instruction: The agent's guiding prompt. This tells the agent what its goal is and how to behave.
- tools: A list of tools that the agent can use. To start, we'll give it the google_search tool, which lets it find up-to-date information online.

I built an agent using Google's ADK that used the `google_search` tool:

```python
root_agent = Agent(
    name="helpful_assistant",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    description="A simple agent that can answer general questions.",
    instruction="You are a helpful assistant. Use Google Search for current info or if unsure.",
    tools=[google_search],
)
```

Once defined, it's time to run it. We need an orchestrator to run our agents. We'll use a `Runner`, which is another central part of the ADK. It manages the conversation, sends our messages to the agent, and handles its responses.

```python
runner = InMemoryRunner(agent=root_agent)
```

:::note
Note that we are using the Python Runner directly in this notebook. You can also run agents using ADK command-line tools such as adk run, adk web, or adk api_server. To learn more, check out the documentation related to [runtime in ADK](https://google.github.io/adk-docs/runtime/).
:::

Now you can call the `.run_debug()` method to send our prompt and get an answer.

👉 This method abstracts the process of session creation and maintenance and is used in prototyping. We'll explore "what sessions are and how to create them" on Day 3.

```python
response = await runner.run_debug(
    "What is Agent Development Kit from Google? What languages is the SDK available in?"
)
```

The agent outputted as follows:

```
### Created new session: debug_session_id

User > What is Agent Development Kit from Google? What languages is the SDK available in?
helpful_assistant > The Agent Development Kit (ADK) from Google is a flexible and modular open-source framework designed to simplify the development, deployment, and orchestration of AI agents. It aims to make building AI agents feel more like traditional software development, enabling developers to create, deploy, and manage agentic architectures, from simple tasks to complex workflows. While optimized for Google's Gemini models and ecosystem, ADK is model-agnostic and deployment-agnostic, making it compatible with other frameworks.

The ADK provides features such as:
*   **Multi-Agent Architecture:** Building modular and scalable applications by composing multiple specialized agents.
*   **Rich Tool Ecosystem:** Equipping agents with pre-built tools, custom functions, OpenAPI specifications, and integrations with third-party libraries.
*   **Flexible Orchestration:** Defining workflows using specialized agents for predictable pipelines or leveraging LLM-driven dynamic routing for adaptive behavior.
*   **Code-First Development:** Defining agent logic, tools, and orchestration directly in code for greater flexibility, testability, and versioning.
*   **Deployment Flexibility:** Deploying agents anywhere, including Google Cloud's Vertex AI Agent Engine for a managed and scalable environment.

The ADK SDK is available in the following languages:
*   **Python**
*   **Go**
*   **Java**
```
### So what happened?
The agent performed a Google Search to get the latest information about ADK, and it knew to use this tool because:

- The agent inspects and is _aware_ of which tools it has available to use.
- The agent's instructions specify the use of the search tool to get current information or if it is unsure of an answer.

The best way to see the full, detailed trace of the agent's thoughts and actions is in the **ADK web UI**. ADK includes a built-in web interface for interactively chatting with, testing, and debugging your agents.
To use the ADK web UI, you'll need to create an agent with Python files using the `adk create` command.

Run the command below to generate a sample-agent folder that contains all the necessary files, including agent.py for your code, an .env file with your API key pre-configured, and an __init__.py file:

```
!adk create sample-agent --model gemini-2.5-flash-lite --api_key $GOOGLE_API_KEY
```

Get your custom URL to access the ADK web UI in the Kaggle Notebooks environment: 
```
url_prefix = get_adk_proxy_url()
```

Now run ADK web: 
```
!adk web --url_prefix {url_prefix}
```

<img width="1200" src="https://storage.googleapis.com/github-repo/kaggle-5days-ai/day1/adk-web-ui.gif" alt="ADK Web UI" />

## Conclusion
The big takeaway is that our agent didn't just respond—it reasoned that it needed more information and then acted by using a tool. This ability to take action is the foundation of all agent-based AI. Next, we'll build a multi-agent system. 

Also, I'll add less documentation to keep this post short and sweet (the introduction is the only exception).

# Day 1b (Multi-agent Systems)
A single monolithic agent is hard to debug and can get confused with trying to do everything at once. Instead, we can build a team of specialized agents that collaborate like a team. 

We'll build a system with two specialized agents:

1. Research Agent - searches for info using Google Search
2. Summarizer Agent - creates concise summaries from research findings

```python
# Research Agent: Its job is to use the google_search tool and present findings.
research_agent = Agent(
    name="ResearchAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    instruction="""You are a specialized research agent. Your only job is to use the
    google_search tool to find 2-3 pieces of relevant information on the given topic and present the findings with citations.""",
    tools=[google_search],
    output_key="research_findings",  # The result of this agent will be stored in the session state with this key.
)
```

```python
# Summarizer Agent: Its job is to summarize the text it receives.
summarizer_agent = Agent(
    name="SummarizerAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    # The instruction is modified to request a bulleted list for a clear output format.
    instruction="""Read the provided research findings: {research_findings}
Create a concise summary as a bulleted list with 3-5 key points.""",
    output_key="final_summary",
)
```

Then we bring the agents together under a **root agent**, or coordinator:

```python
# Root Coordinator: Orchestrates the workflow by calling the sub-agents as tools.
root_agent = Agent(
    name="ResearchCoordinator",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    # This instruction tells the root agent HOW to use its tools (which are the other agents).
    instruction="""You are a research coordinator. Your goal is to answer the user's query by orchestrating a workflow.
1. First, you MUST call the `ResearchAgent` tool to find relevant information on the topic provided by the user.
2. Next, after receiving the research findings, you MUST call the `SummarizerAgent` tool to create a concise summary.
3. Finally, present the final summary clearly to the user as your response.""",
    # We wrap the sub-agents in `AgentTool` to make them callable tools for the root agent.
    tools=[AgentTool(research_agent), AgentTool(summarizer_agent)],
)

print("✅ root_agent created.")
```

`AgentTool` wraps the sub-agents to make them callable tools for the root agent. 

```python
# Running the agent
runner = InMemoryRunner(agent=root_agent)
response = await runner.run_debug(
    "What are the latest advancements in quantum computing and what do they mean for AI?"
)
```

We built a multi-agent system. The single "coordinator" agent manages the other agents, using them as tools. 

However, relying on an LLM's instructions to control the order can sometimes be unpredictable. Next, we'll explore a different pattern that gives you guaranteed, step-by-step execution.

## Sequential Workflows - The Assembly Line
The previous multi-agent system worked, but it relied on a detailed instruction prompt to force the LLM to run steps in order. This can be unreliable. A complex LLM might decide to skip a step, run them in the wrong order, or get "stuck," making the process unpredictable.

The solution is to create a fixed pipeline where tasks happen in a guaranteed, specific order: a `SequentialAgent`. This agent acts like an assembly line, running each sub-agent in the exact order you list them.

<img width="1000" src="https://storage.googleapis.com/github-repo/kaggle-5days-ai/day1/sequential-agent.png" alt="Sequential Agent" />

We'll use three specialized agents:

1. Outline Agent - Creates a blog outline for a given topic
2. Writer Agent - Writes a blog post
3. Editor Agent - Edits a blog post draft for clarity and structure

```python
# Outline Agent: Creates the initial blog post outline.
outline_agent = Agent(
    name="OutlineAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    instruction="""Create a blog outline for the given topic with:
    1. A catchy headline
    2. An introduction hook
    3. 3-5 main sections with 2-3 bullet points for each
    4. A concluding thought""",
    output_key="blog_outline",  # The result of this agent will be stored in the session state with this key.
)
```

```python
# Writer Agent: Writes the full blog post based on the outline from the previous agent.
writer_agent = Agent(
    name="WriterAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    # The `{blog_outline}` placeholder automatically injects the state value from the previous agent's output.
    instruction="""Following this outline strictly: {blog_outline}
    Write a brief, 200 to 300-word blog post with an engaging and informative tone.""",
    output_key="blog_draft",  # The result of this agent will be stored with this key.
)
```

```python
# Editor Agent: Edits and polishes the draft from the writer agent.
editor_agent = Agent(
    name="EditorAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    # This agent receives the `{blog_draft}` from the writer agent's output.
    instruction="""Edit this draft: {blog_draft}
    Your task is to polish the text by fixing any grammatical errors, improving the flow and sentence structure, and enhancing overall clarity.""",
    output_key="final_blog",  # This is the final output of the entire pipeline.
)
```

Now, we put them all together under the sequential agent, which runs the agents in the order that they are listed:

```python
root_agent = SequentialAgent(
    name="BlogPipeline",
    sub_agents=[outline_agent, writer_agent, editor_agent],
)
```

```
# Running the root_agent
runner = InMemoryRunner(agent=root_agent)
response = await runner.run_debug(
    "Write a blog post about the benefits of multi-agent systems for software developers"
)
```

This is perfect for **tasks that build on each other**, but it's slow if the tasks are independent. Next, we'll look at how to run multiple agents at the same time to speed up your workflow.

## Parallel Workflows - Independent Researchers

<img width="600" src="https://storage.googleapis.com/github-repo/kaggle-5days-ai/day1/parallel-agent.png" alt="Parallel Agent" />

A sequential agent works great, but think of it as an assembly line. Each step has to wait for the previous one to finish. What if you have several tasks that aren't dependent on each other? For example, researching three different topics. Running them in sequence has no point - we would just make our workflow slow and inefficient. 

### The solution? Concurrent/parallel execution.
When you have independent tasks, you can run them all at the same time using a `ParallelAgent`. Once all parallel tasks are complete, you can then pass their combined results to a final 'aggregator' step.

Our system will have four agents: 

1. **Tech Researcher** - Researches AI/ML news and trends
2. **Health Researcher** - Researches recent medical news and trends
3. **Finance Researcher** - Researches finance and fintech news and trends
4. **Aggregator Agent** - Combines all research findings into a single 

```python
# Tech Researcher: Focuses on AI and ML trends.
tech_researcher = Agent(
    name="TechResearcher",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    instruction="""Research the latest AI/ML trends. Include 3 key developments,
the main companies involved, and the potential impact. Keep the report very concise (100 words).""",
    tools=[google_search],
    output_key="tech_research",  # The result of this agent will be stored in the session state with this key.
)
```

```python
# Health Researcher: Focuses on medical breakthroughs.
health_researcher = Agent(
    name="HealthResearcher",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    instruction="""Research recent medical breakthroughs. Include 3 significant advances,
their practical applications, and estimated timelines. Keep the report concise (100 words).""",
    tools=[google_search],
    output_key="health_research",  # The result will be stored with this key.
)
```

```python
# Finance Researcher: Focuses on fintech trends.
finance_researcher = Agent(
    name="FinanceResearcher",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    instruction="""Research current fintech trends. Include 3 key trends,
their market implications, and the future outlook. Keep the report concise (100 words).""",
    tools=[google_search],
    output_key="finance_research",  # The result will be stored with this key.
)
```

```python
# The AggregatorAgent runs *after* the parallel step to synthesize the results.
aggregator_agent = Agent(
    name="AggregatorAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    # It uses placeholders to inject the outputs from the parallel agents, which are now in the session state.
    instruction="""Combine these three research findings into a single executive summary:

    **Technology Trends:**
    {tech_research}
    
    **Health Breakthroughs:**
    {health_research}
    
    **Finance Innovations:**
    {finance_research}
    
    Your summary should highlight common themes, surprising connections, and the most important key takeaways from all three reports. The final summary should be around 200 words.""",
    output_key="executive_summary",  # This will be the final output of the entire system.
)
```

👉 Then we bring the agents together under a parallel agent, which is itself nested inside of a sequential agent.

This ensures the research agents run first in parallel, then once all of their research is complete, the aggregator agent brings them all together into a single report.

```python
# The ParallelAgent runs all its sub-agents simultaneously.
parallel_research_team = ParallelAgent(
    name="ParallelResearchTeam",
    sub_agents=[tech_researcher, health_researcher, finance_researcher],
)

# This SequentialAgent defines the high-level workflow: run the parallel team first, then run the aggregator.
root_agent = SequentialAgent(
    name="ResearchSystem",
    sub_agents=[parallel_research_team, aggregator_agent],
)
```

```python
# Running the agent
runner = InMemoryRunner(agent=root_agent)
response = await runner.run_debug(
    "Run the daily executive briefing on Tech, Health, and Finance"
)
```

All our workflows so far run from start to finish and then stop. But what if we need to review and improve the output multiple times? I've done this before in LangGraph using a revision tool. With Google ADK, we can use loops.

## Loop Workflows - The Refinement Cycle
The `SequentialAgent` and `ParallelAgent` produce their final output and then stop. This approach isn't good for tasks that require refinemnt and quality control. What if the first draft isn't good enough?

When a task needs to be improved through cycles of feedback and revision, you can use a `LoopAgent`. When a task needs to be improved through cycles of feedback and revision, you can use a `LoopAgent`. 

<img width="250" src="https://storage.googleapis.com/github-repo/kaggle-5days-ai/day1/loop-agent.png" alt="Loop Agent" />

### Example: Iterative Story Refinement

Let's build a system with two agents:

1. Writer Agent - Writes a draft of a short story
2. Critic Agent - Reviews and critiques the short story to suggest improvements

```python
# This agent runs ONCE at the beginning to create the first draft.
initial_writer_agent = Agent(
    name="InitialWriterAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    instruction="""Based on the user's prompt, write the first draft of a short story (around 100-150 words).
    Output only the story text, with no introduction or explanation.""",
    output_key="current_story",  # Stores the first draft in the state.
)
```

We'll use a Python function to give the agent an explicit signal of when to terminate the loop.

```python
# This is the function that the RefinerAgent will call to exit the loop.
def exit_loop():
    """Call this function ONLY when the critique is 'APPROVED', indicating the story is finished and no more changes are needed."""
    return {"status": "approved", "message": "Story approved. Exiting refinement loop."}
```

We have the exit function now, but we need to wrap this up within a tool for an agent to be able to use it.

👉 **Notice its instructions:** this agent is the "brain" of the loop. It reads the `{critique}` from the `CriticAgent` and decides whether to (1) call the `exit_loop` tool or (2) rewrite the story.

```python
# This agent refines the story based on critique OR calls the exit_loop function.
refiner_agent = Agent(
    name="RefinerAgent",
    model=Gemini(
        model="gemini-2.5-flash-lite",
        retry_options=retry_config
    ),
    instruction="""You are a story refiner. You have a story draft and critique.
    
    Story Draft: {current_story}
    Critique: {critique}
    
    Your task is to analyze the critique.
    - IF the critique is EXACTLY "APPROVED", you MUST call the `exit_loop` function and nothing else.
    - OTHERWISE, rewrite the story draft to fully incorporate the feedback from the critique.""",
    output_key="current_story",  # It overwrites the story with the new, refined version.
    tools=[
        FunctionTool(exit_loop)
    ],  # The tool is now correctly initialized with the function reference.
)
```

Then we bring the agents together under the loop agent, which itself is nested inside of a sequential agent. Remember, first we want the writer to write, then go into the story refinement loop. These two must happen sequentially.  

```python
# The LoopAgent contains the agents that will run repeatedly: Critic -> Refiner.
story_refinement_loop = LoopAgent(
    name="StoryRefinementLoop",
    sub_agents=[critic_agent, refiner_agent],
    max_iterations=2,  # Prevents infinite loops
)

# The root agent is a SequentialAgent that defines the overall workflow: Initial Write -> Refinement Loop.
root_agent = SequentialAgent(
    name="StoryPipeline",
    sub_agents=[initial_writer_agent, story_refinement_loop],
)
```

Finally, let's run the agent.

```python
# Running the agent
runner = InMemoryRunner(agent=root_agent)
response = await runner.run_debug(
    "Write a short story about a lighthouse keeper who discovers a mysterious, glowing map"
)
```

# Summary

<img width="1000" src="https://storage.googleapis.com/github-repo/kaggle-5days-ai/day1/agent-decision-tree.png" alt="Agent Decision Tree" />

### Quick Reference Table

| Pattern | When to Use | Example | Key Feature |
|---------|-------------|---------|-------------|
| **LLM-based (sub_agents)** | Dynamic orchestration needed | Research + Summarize | LLM decides what to call |
| **Sequential** | Order matters, linear pipeline | Outline → Write → Edit | Deterministic order |
| **Parallel** | Independent tasks, speed matters | Multi-topic research | Concurrent execution |
| **Loop** | Iterative improvement needed | Writer + Critic refinement | Repeated cycles |

In day 1, I learned how to use build a single agent and multi-agent system. In multi-agent systems there are different types of agents we can use, depending on our use case. Next, in day 2, I'll be learning more about agent tools and interoperability with model context protocol (MCP).
