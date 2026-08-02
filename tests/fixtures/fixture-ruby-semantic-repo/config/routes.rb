route_prefix = :checkout

Rails.application.routes.draw do
  root "home#index"
  concern :previewable do
    get "/preview", to: "checkouts#preview"
  end
  concern :cycle_a do
    concerns :cycle_b
  end
  concern :cycle_b do
    concerns :cycle_a
  end
  concern :duplicated do
    get "/first_duplicate", to: "checkouts#show"
  end
  concern :duplicated do
    get "/second_duplicate", to: "checkouts#show"
  end
  concerns :duplicated
  concerns :missing_concern
  resources :checkouts
  resources :checkouts, concerns: [:previewable, dynamic_concern]
  resources :checkouts do
    concerns :previewable
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
