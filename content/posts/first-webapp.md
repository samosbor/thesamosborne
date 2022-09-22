---
title: "My First Attempt at Building a Web App"
date: 2021-03-28T19:34:46+07:00
draft: false
weight: 1
aliases: []
tags: ["blog", "tech", "programming"]
author: "Sam Osborne"
---
One of my college courses required me to build an application as a semester long project. I wanted to build an application that could solve a real world problem. I had heard about a problem that doctors were having from a friend of mine. Doctors get sued. A lot. 75% of doctors in low-risk specialties have faced a malpractice claim at some point in their careers. For doctors in high-risk specialties, that number skyrockets to 99%. I decided to make a **webapp** to help doctors solve this problem. You can check it out here: [patientpreviewapp.com](https://app.patientpreviewapp.com/search)  

![](https://everything.azureedge.net/blog/x6mZOzh.png)

This was the first time I had ever tried to build a real app that would get used by anyone other than myself. I learned a ton about what not to do when going through this process. I mainly used **Azure** services throughout the project because I had some free Azure credit on my account. Here’s how I did it and what I learned.  

### Main Web App
Here I used **VueJS** for the front-end and **NodeJS** for the back-end. My first dev job had been mostly front-end Vue work, so I am naturally biased towards it now. I picked Node because it seemed like the hotness at the time. Every tutorial I looked up was using a NodeJS Express server. I love both technologies and still use them to this day.  

What I don’t love is how I decided to deploy the web app. I was under the impression that for a webapp to be legit it had to use containers. So, I containerized both my Vue and Node apps separately and stored them in an **Azure Container Registry**. From here I deployed the containers to **Azure App Service**. Turns out this is way overkill. I spent a ton of time learning docker files and debugging the automatic deployments. Eventually I got it all figured out and it works pretty well, seeing as it’s still [up and available](https://app.patientpreviewapp.com/search) without me touching it for over a year. 

I have a whole continuous integration setup on **Azure DevOps** where my repo is hosted. On push, it builds the app and the docker containers and pushes them to the container registry. Then the Azure App Service sees the updated container images through a webhook and deploys them to serve the site. My Azure Pipeline YAML file looks like this: 
```yml
# Docker

trigger:
  branches:
    include:
    - master
  paths:
    include:
    - 'client'
    - 'server'

resources:
- repo: self

variables:
  # Container registry service connection established during pipeline creation
  dockerRegistryServiceConnection: '********-****-****-****-d747da49a3cd'
  containerRegistry: 'patientpreview01.azurecr.io'
  tag: '$(Build.BuildId)'

  imageRepository-server: 'prodserver'
  dockerfilePath-server: 'server/Dockerfile'

  imageRepository-client: 'prodclient'
  dockerfilePath-client: 'client/Dockerfile'
  
  # Agent VM image name
  vmImageName: 'ubuntu-latest'

stages:
- stage: Build
  displayName: Build and push stage
  jobs:  
  - job: Build
    displayName: Build
    pool:
      vmImage: $(vmImageName)
    steps:
    - task: Docker@2
      displayName: Server - Build and push container
      inputs:
        command: buildAndPush
        repository: $(imageRepository-server)
        dockerfile: $(dockerfilePath-server)
        containerRegistry: $(dockerRegistryServiceConnection)
        tags: |
          $(tag)
          latest
    - task: Docker@2
      displayName: Client - Build and push container
      inputs:
        command: buildAndPush
        repository: $(imageRepository-client)
        dockerfile: $(dockerfilePath-client)
        containerRegistry: $(dockerRegistryServiceConnection)
        tags: |
          $(tag)
          latest
```  

I later learned that, while some large companies might want to deploy their static Vue site like this, I definitely did not need to. I could have just dropped my compiled HTML files on some server or used any number of simple resources for hosting static sites (eg. Github Pages, Netlify). I did learn a lot about containers and continuous integration though!

### Database
**Azure MySQL Server** works really well. I love how easy it is to setup a SQL database in Azure and connect to it from anywhere. It’s nice to have someone else manage the server and keep all that out of my code base. I don’t love the cost of this service. It’s by far the most expensive part of my website every month at $15. I would not personally pay for this, but with my free Azure credit it was no big deal. 

### WordPress site
I set up a **WordPress** site as a separate web app on Azure App Service. This thing gave me so much trouble, and I gave up on it. The WordPress site would go down randomly, and it was really slow when it was up. I would recommend using a different WordPress service or a full VM instance that you can play with. WordPress in an Azure App Service gets a 0/10 from me. All that remains of the WordPress site is this screenshot of the landing page:

![](https://everything.azureedge.net/blog/tzYdToc.png)  

### Data Collection
I use a variety of technologies to get data and make it searchable on my site. For scraping I use a software called **Mozenda**. I used to work there back in college and still have a free account. Mozenda has a feature where you can scrape a website and then dump the data to an **Azure Storage Blob Container** as a .csv file.  

After scraping the data I had to get it into my database, so I setup an asynchronous web function through **Azure Functions**. My function got triggered whenever it detected a new data file in my storage container. From there it would extract the data from the .csv, transform it to fit my database schema, then load it line-by-line into my database. I thought this pipeline of data was so cool but I later learned that Extract, Transform, Load (ETL) is a [really common thing](https://en.wikipedia.org/wiki/Extract,_transform,_load). I still think it's cool anyway. Here is the bulk of the Azure Function:  

```javascript
// Grab .csv file from blob container -- *Extract
var file = JSON.parse(myBlob.toString())

var bulkRows = []
file.Default.forEach(element => {
  // Fix each row with the 'fixRow' function -- *Transform
  var row = fixRow(element)
  bulkRows.push(row)
})

// Push the formatted rows into my database -- *Load
let sql = `INSERT INTO lawsuit(CaseName, Plaintiff, Defendant, State) VALUES ?`
conn.query(sql, [bulkRows], (err, results, fields) => {
  context.log('Successfully inserted '+ results.affectedRows +'')
})
```  

### Domain
You can buy domains with free Azure credit! I was shocked by this. **App Service Domains** support a few TLDs including com, net, co.uk, org, nl, in, biz, org.uk, and co.in. They automate SSL certs for you too for all your HTTPS needs. Not the most robust service, but free is free!

I never really finished the site after the semester ended. I had a **Stripe** integration almost complete but then I lost interest. Turns out that this exact idea had been done by a friend of a friend (Can't actually find that site, but it's out there somewhere). Also, I was browsing Hacker News one day and saw a [site with full text search of 400M US Court Cases](https://news.ycombinator.com/item?id=25150702). That made me feel a little inadequate. Maybe one day I'll come back and make a ton of money, but probably not. Either way, it was fun and I learned a lot about building web applications.


![](https://everything.azureedge.net/blog/8xKuKAG.png)

*Thats a lot of resources for one project!*  

{{< subscribe-tech >}}