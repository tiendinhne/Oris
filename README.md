# 🌟 ORIS - Social Network Platform

A modern, microservice-based social network built for scalability and learning.

## 🚀 Features

- **User Management**: Registration, Login, Profiles, Follow System
- **Post Creation**: Create, Edit, Delete posts with rich content
- **Interactions**: Like, Comment, and engage with other users
- **Real-time Notifications**: Get notified instantly about activities
- **Advanced Search**: Full-text search across users and posts
- **Recommendations**: Personalized feed based on your interests
- **Trending**: Discover trending topics and popular posts

## 🏗️ Architecture

ORIS is built using **Microservices Architecture** with 6 independent services:

| Service | Technology | Port | Responsibility |
|---------|-----------|------|-----------------|
| **User Service** | Node.js Express | 3001 | Authentication, Profiles, Follow |
| **Post Service** | Java Spring Boot | 8080 | Create, Read, Update, Delete Posts |
| **Comment & Like Service** | PHP Laravel | 8001 | Comments, Likes, Reactions |
| **Notification Service** | Python Django | 8002 | Real-time Notifications |
| **Search Service** | Golang | 5000 | Full-text Search (Elasticsearch) |
| **Feed & Recommendation** | Golang | 5001 | Personalized Feed, Recommendations |

## 📦 Tech Stack

- **Backend**: Node.js, Java Spring Boot, PHP Laravel, Python Django, Golang
- **Message Queue**: RabbitMQ (Event-driven communication)
- **Caching**: Redis
- **Search Engine**: Elasticsearch
- **Databases**: PostgreSQL, MySQL, MongoDB
- **API Gateway**: Nginx
- **Container**: Docker & Docker Compose
- **Frontend**: React.js

### Installation

# Start all services with Docker Compose
docker-compose up -d

# Access API Gateway
http://localhost:80

# Access Frontend
http://localhost:3000


Made with ❤️ by ORIS Team