---
title: "Free VPNs in 9 Different Countries"
date: 2021-11-08T17:27:35-08:00
draft: false
weight: 1
aliases: []
tags: ["blog", "tech", "programming"]
author: "Sam Osborne"
cover:
  image: ""
---
Apparently the BBC doesn’t let you watch their TV shows if you’re not in the UK. I was trying to watch *This Country* but I was greeted with this prohibiting banner:  
![Imgur](https://i.imgur.com/g3BJ4zR.png)
![](https://i.imgur.com/jJU8Gnj.png)

No worries, I have a subscription to Nord VPN and they have servers in the UK. I switched my location to the UK and reloaded the page. No luck:  

![](https://i.imgur.com/ullCef2.png)

I read their help page and they have some VPN tracking software in place that seems like it blocked most of Nord’s IP addresses already.  

I wondered if the BBC would block Azure IPs. So, I made a virtual machine in the Azure UK region and logged into it. I went to BBC from the virtual machine, and it worked perfectly. The BBC didn’t care about blocking traffic from an Azure data center. 
This meant that if I could route my traffic through a UK Azure data center, the BBC would think I enjoy tea and crumpets and let me watch all their shows.  

I looked up the best self-hosted VPN software and Wireguard is the only thing anyone is talking about right now. So, I made a new small Linux Virtual Machine and installed the Wireguard docker image on it. I downloaded the config file to my local PC and turned on the VPN connection. Bam:  

![](https://i.imgur.com/XMQ9D8M.png)  

I am now British  

Azure has more than just the UK region though. They have regions in a dozen countries, and it would be cool to set up VPNs in other regions too. 
I was halfway into setting up my Singapore VPN when my hand got tired and I thought, I am lazy. I had heard about a thing called Terraform. It is a kind of programming language that sets up cloud infrastructure like virtual machines automatically. Pretty perfect for setting up multiple identical machines, just in different regions. I’d never used Terraform before, but I read some tutorials and picked up the basics.  

I didn’t want to have to reinstall Wireguard and Docker and a few other things every time I created a new virtual machine, so I would need to make a custom image (blueprint) for my new virtual machines to clone from. I already had one working virtual machine with Wireguard set up in the UK, so I used the Azure “capture” feature to create a custom image from that existing machine. Once I had the custom image to clone from, I wrote two Terraform files to automate the process of deploying VPNs in as many of the Azure regions as I want.  

First, the main file where I declare my Azure credentials and some variables, including the list of every region I want to use:  

{{< code-expand >}}

```terraform
terraform {

  required_version = ">=0.12"

  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
      version = "~>2.0"
    }
  }
}

provider "azurerm" {
  features {}

  subscription_id   = "<subscription_id_here>"
  tenant_id         = "<subscription_id_here>"
  client_id         = "<client_id_here>"
  client_secret     = "<client_secret_here>"
}

module "vm" {
  source = "./vms"
  for_each = toset( 
    ["uksouth", "southeastasia", "australiaeast", "southafricanorth",
     "centralindia", "francecentral", "switzerlandnorth", "uaenorth", "brazilsouth"] )
  region = each.key
  username = "myusername_here"
  password = "mypassword_here"
  blobkey = "myblobstoragekey_here_for_sending_wireguard_credentials"
}
```

Then, the Virtual Machine “VM” module that gets looped over for every region in my list:  

```terraform
variable "region" {}
variable "username" {}
variable "password" {}
variable "blobkey" {}

# Create a resource group if it doesn't exist
resource "azurerm_resource_group" "myterraformgroup" {
    name     = "wireguard-${var.region}"
    location = var.region
}

# Create virtual network
resource "azurerm_virtual_network" "myterraformnetwork" {
    name                = "vnet-${var.region}"
    address_space       = ["10.0.0.0/16"]
    location            = azurerm_resource_group.myterraformgroup.location
    resource_group_name = azurerm_resource_group.myterraformgroup.name
}

# Create subnet
resource "azurerm_subnet" "myterraformsubnet" {
    name                 = "subnet-${var.region}"
    resource_group_name  = azurerm_resource_group.myterraformgroup.name
    virtual_network_name = azurerm_virtual_network.myterraformnetwork.name
    address_prefixes       = ["10.0.1.0/24"]
}

# Create public IPs
resource "azurerm_public_ip" "myterraformpublicip" {
    name                         = "publicIp-${var.region}"
    location                     = azurerm_resource_group.myterraformgroup.location
    resource_group_name          = azurerm_resource_group.myterraformgroup.name
    allocation_method            = "Static"

}

# Create Network Security Group and rule
resource "azurerm_network_security_group" "myterraformnsg" {
    name                = "nsg-${var.region}"
    location            = azurerm_resource_group.myterraformgroup.location
    resource_group_name = azurerm_resource_group.myterraformgroup.name

    security_rule {
        name                       = "SSH"
        priority                   = 1001
        direction                  = "Inbound"
        access                     = "Allow"
        protocol                   = "Tcp"
        source_port_range          = "*"
        destination_port_range     = "22"
        source_address_prefix      = "*"
        destination_address_prefix = "*"
    }

    security_rule {
        name                       = "Wireguard"
        priority                   = 301
        direction                  = "Inbound"
        access                     = "Allow"
        protocol                   = "Udp"
        source_port_range          = "*"
        destination_port_range     = "51820"
        source_address_prefix      = "*"
        destination_address_prefix = "*"
    }

}

# Create network interface
resource "azurerm_network_interface" "myterraformnic" {
    name                      = "nic-${var.region}"
    location                  = azurerm_resource_group.myterraformgroup.location
    resource_group_name       = azurerm_resource_group.myterraformgroup.name

    ip_configuration {
        name                          = "nicConfig-${var.region}"
        subnet_id                     = azurerm_subnet.myterraformsubnet.id
        private_ip_address_allocation = "Dynamic"
        public_ip_address_id          = azurerm_public_ip.myterraformpublicip.id
    }

}

# Connect the security group to the network interface
resource "azurerm_network_interface_security_group_association" "example" {
    network_interface_id      = azurerm_network_interface.myterraformnic.id
    network_security_group_id = azurerm_network_security_group.myterraformnsg.id
}

# Get the custom image that I built
data "azurerm_shared_image_version" "example" {
  name                = "latest"
  image_name          = "wireguard-general"
  gallery_name        = "Imagegallery"
  resource_group_name = "wireguard-uk"
}

# Create virtual machine and send connection config to blob container
resource "azurerm_linux_virtual_machine" "myterraformvm" {
    name                  = "wireguard-${var.region}"
    location              = azurerm_resource_group.myterraformgroup.location
    resource_group_name   = azurerm_resource_group.myterraformgroup.name
    network_interface_ids = [azurerm_network_interface.myterraformnic.id]
    size                  = "Standard_B1s"

    os_disk {
        name              = "myOsDisk"
        caching           = "ReadWrite"
        storage_account_type = "Premium_LRS"
    }

    source_image_id = data.azurerm_shared_image_version.example.id

    computer_name  = "wireguard-${var.region}"
    admin_username = var.username
    admin_password = var.password
    disable_password_authentication = false

  provisioner "remote-exec" {
    inline = [
      "sleep 1m",

      "az storage blob upload --account-name everythingstorage159 \
      --account-key ${var.blobkey} --container-name wireguard \
      --file /home/sam/wireguard/config/peer_samphone/peer_samphone.png \
      --name $(date +%F)/samphone_${var.region}.png",

      "az storage blob upload --account-name everythingstorage159 \
      --account-key ${var.blobkey} --container-name wireguard \
      --file /home/sam/wireguard/config/peer_samdesk/peer_samdesk.conf \
      --name $(date +%F)/samdesk_${var.region}.conf"
    ]

    connection {
      type = "ssh"
      user = var.username
      password = var.password
      host = azurerm_public_ip.myterraformpublicip.ip_address
    }
  }
}
```


These Terraform scripts create nine virtual machines, all running Wireguard VPN software to let me pretend I am from a different country. 
I can connect to any of them from my phone or my desktop whenever I want.  

![Imgur](https://i.imgur.com/wjryL6ul.jpg)

![Imgur](https://i.imgur.com/Bu57ZR7.png)

And its all free! (*if you have free Azure credit… its actually like $8/month/VM lmao clickbait*)

{{< subscribe-tech >}}