route_prefix = :checkout

Rails.application.routes.draw do
  root "home#index"
  resources :checkouts
  resources :checkouts do
    member do
      get :preview
    end
    collection do
      get :search
    end
    get :archive, on: :collection
  end
  resource :session
  get "/health", controller: "home", action: "index"
  resources :reports, controller: "admin/widgets"
  resources :widgets, module: :admin
  get "/checkout/:id", to: "checkouts#show"
  post "/checkout", to: "checkouts#create"
  match "/legacy", to: "checkouts#legacy", via: :all
  get "/computed", to: route_prefix
  resources route_prefix
  namespace :admin do
    resources :checkouts
    root "dashboard#index"
    get "/checkout/:id" => "checkouts#show"
  end
  get "/admin/widgets/:id" => "admin/widgets#show"
  scope "/admin" do
    resources :widgets
  end
  scope module: :admin do
    resources :widgets
  end
  draw :admin
end
