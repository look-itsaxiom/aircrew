# Aircrew

Aircrew is a tool that enables copilot to become a full engineering team through the use of contextual container environments orchestrated by an agentic AI "Project Manager"

The intended use case is to extend agentic models to handle larger tasks that require a multitude of steps, have dependencies, and need planning and decsision making to complete.

---

## Concept

Taking inspiration from how Agile software development teams typically function, the tool is organized by roles:

- *Project Manager*: "PM"
- *Architect*: "Arc"
- *Developer*: "Dev"
- *Quality Assurance*: "QA"
- *Documentation*: "Doc"

Each role is a seperate runtime instance of code-server, and contains an authenticated instance of the Github Copilot extension, a copilot-instructions.md file, an mcp server for interacting with the other roles, and any helpful resources that allow that agent to be more specialized in their tasks.

The main service, *PM*, is interacted with by the user through a generic LLM chat interface, during this interaction, *PM* seeks to understand the problem at hand that their team will be in charge of handling. 

For this example, lets say we give them the task to "create a landing page to market our product with a newsletter signup form that connects to our surveymonkey mailing list." 

*PM* will probably ask a few qualifying questions such as "what is your product", "does your company have a branding defintion for the landing page to follow", or "what is the look and feel your product is trying to express?" and may even ask for technical implementation preferences. Their role at this stage is to probe for as many requirements as they can, this is important as their role in the later processes is to act as an SME for the project definition.

Once *PM* has collected information from the user, it'll start a running job instance for that project type. At this stage, *PM* is organizing all of its understanding of the user's requirements into a document they can refer back to later. PM then uses this document to coordinate with another role, *Arc*, to create an implementation plan for the requested project. 

*Arc* differs greatly in nature to *PM* because its role requires the process of solving problems, not necessarily defining them. This is the main seperation that exists between *PM* and the "tasker" roles, specialty in their ability to perform a function and only expected to perform one task or piece of work at a time. *PM* is in charge of creating those tasks and managing them as work is done to complete them. 

*PM* creates the task of creating an implementation plan, and attaches the requirements document along with it before assigning the task to *Arc*. *Arc* is built with tools like concept7, has access to software architecture best practices, modern technology defintions, and other specialized resources so that it can perform the task of planning the technical implementation as effectively as possible. Not only will it need to make opinionated decisions on how best to go about creating a solution to the request, but it also needs to be able to break down the solution into workable steps for *PM* to distribute to other workers. When *Arc* has completed its implementation plan, it sends it back over to *PM* for evaluation of whether that solution will meet the requirements of the request. If it doesn't, *PM* will provide feedback of why it doesn't meet those requirements, and re-assign the task to *Arc*.

If the implementation plan created by *Arc* is satisfactory to the requirements of the request, *PM* begins creating a sequenced set of tasks based on that plan. It does its best to identify the dependency chain for the project and identifies where tasks could be completed in parallel. Once the tasks are completed we move to the main loop of what this tool does.

For each of the tasks that have been created, and following the dependency chain required by the project, *PM* assigns a *Dev* to a given task. This process is very similar to how Github Copilot coding agents work, a *Dev* shouldn't be given an intensely large task or really require any kind of decision making to complete their assigned task outside of implementation decisions not covered by the plan, maintaining code quality, and aligning with best practices for whatever technology is being used. A *Dev*'s environment is a much heavier version of code-server, providing access to extensions needed for running projects, mcp servers for interacting with the web browser and will probably need to install software in its environment to properly work in the project.

Once *Dev* has created a first draft of an implementation of the task, it reports back to *PM* with a pull request. *PM* then assigns a *QA* to test that branch against the requirements and acceptance criteria for that task. *QA*'s environment is setup with testing framework documentation, has more access to the project context, and has mcp tools heavily geared towards interaction with existing software. After *QA*'s testing, it reports back to *PM* regarding if the solution meets the acceptance criteria of the task at hand. If it does not, then *QA* reports specifically where it is lacking and *PM* reassigns the task to a *Dev* with that information. If it does meet the acceptance criteria, then *PM* merges the pull request and assigns the next task in the dependency chain to a *Dev*, thus creating a loop until the final task is complete. At this step, *PM* also assigns a *Doc* to create a summary of the work completed and that is going in and save it to a log of the project.

Once the final task is complete, *PM* reports back to the user the results along with the log of the actions taken to create the result.

---

## Why?

As I have used AI tools in my developer workflow more and more, it has frequently frustrated me that I was the bottleneck in the flow of prompts that would lead to a given task being completed. Agentic models have come a long way, but they do not excel currently at tasks that require many different steps that have to be coordinated over an extended period of time. This is where I, the user, would have to manage keeping each work item as small as possible to allow the model to not be burdened to heavily with the load of context.

That responsibility is the bottleneck that I'm referring to as I am human and cannot be monitoring the results of tasks of more than maybe 2 agents at the same time. Thus this project was born, mainly out of curiousity, to test if an AI could perform the management of other AIs similar to how engineering teams function within organizations